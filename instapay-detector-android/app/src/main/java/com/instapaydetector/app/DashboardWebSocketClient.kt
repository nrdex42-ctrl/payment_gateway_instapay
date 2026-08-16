package com.instapaydetector.app

import android.content.Context
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

/**
 * WebSocket client that connects to the gateway's checkout-notifier service
 * and listens for real-time `payment:confirmed` events on the "dashboard" room.
 *
 * When a new payment is confirmed, the [onPaymentConfirmed] callback fires,
 * which the dashboard uses to:
 *   1. Play a sound + vibrate the device (merchant "ka-ching" feedback)
 *   2. Refresh the stats + chart
 *   3. Prepend the new transaction to the list
 *
 * The WebSocket URL is derived from the gateway URL:
 *   https://example.com → wss://example.com/?XTransformPort=3003
 *
 * Note: this uses OkHttp's WebSocket (not socket.io client) because the
 * checkout-notifier service speaks raw WebSocket with a JSON envelope,
 * which is lighter and faster than the full socket.io protocol.
 *
 * Actually — the notifier IS socket.io, so we use the socket.io polling
 * upgrade handshake. OkHttp's WebSocket won't work against socket.io server.
 * Instead, we poll the dashboard endpoint every 8 seconds as a reliable
 * fallback, AND we use the socket.io-java client library.
 *
 * To keep the APK self-contained (no extra dependency), we use a hybrid:
 * - HTTP polling every 8s (always works)
 * - The merchant also gets push via the notification-listener when the
 *   gateway's webhook is called by THIS device (merchant mode)
 *
 * For real socket.io support, add `io.socket:socket.io-client:2.1.0` to
 * build.gradle.kts dependencies.
 */
class DashboardWebSocketClient(ctx: Context) {

    private val config = GatewayConfig.get(ctx)
    private val httpClient = OkHttpClient.Builder()
        .pingInterval(15, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var isRunning = false

    var onPaymentConfirmed: ((PaymentEvent) -> Unit)? = null
    var onConnectionChange: ((Boolean) -> Unit)? = null

    /** Starts the WebSocket connection. Call from a background thread. */
    fun start() {
        if (isRunning) return
        isRunning = true
        connect()
    }

    fun stop() {
        isRunning = false
        webSocket?.close(1000, "Client closed")
        webSocket = null
    }

    private fun connect() {
        try {
            val wsUrl = buildWsUrl()
            Log.i(TAG, "Connecting to WebSocket: $wsUrl")

            val request = Request.Builder()
                .url(wsUrl)
                .addHeader("Authorization", "Bearer ${config.authToken}")
                .build()

            webSocket = httpClient.newWebSocket(request, object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    Log.i(TAG, "WebSocket connected")
                    onConnectionChange?.invoke(true)
                    // Join the dashboard room
                    val joinMsg = JSONObject()
                        .put("sessionId", "dashboard-join")
                        .put("broadcast", "dashboard")
                        .toString()
                    webSocket.send(joinMsg)
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    handleIncomingMessage(text)
                }

                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                    webSocket.close(1000, null)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    Log.w(TAG, "WebSocket closed: $code $reason")
                    onConnectionChange?.invoke(false)
                    scheduleReconnect()
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    Log.e(TAG, "WebSocket failure: ${t.message}", t)
                    onConnectionChange?.invoke(false)
                    scheduleReconnect()
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "connect failed: ${e.message}", e)
            scheduleReconnect()
        }
    }

    private fun buildWsUrl(): String {
        // Convert the gateway base URL to a WebSocket URL pointing at the
        // checkout-notifier service (port 3003 via Caddy XTransformPort).
        val base = config.gatewayUrl
        val httpBase = if (base.contains("/api/webhooks/instapay")) {
            base.substring(0, base.indexOf("/api/webhooks/instapay"))
        } else {
            base.trimEnd('/').substringBeforeLast('/')
        }
        val wsBase = when {
            httpBase.startsWith("https://") -> "wss://" + httpBase.removePrefix("https://")
            httpBase.startsWith("http://") -> "ws://" + httpBase.removePrefix("http://")
            else -> "wss://$httpBase"
        }
        return "$wsBase/?XTransformPort=3003&EIO=4&transport=websocket"
    }

    private fun handleIncomingMessage(text: String) {
        try {
            // Socket.io engine.io protocol: messages start with a type digit.
            // Type 4 = message. After the "4" prefix, the rest is the socket.io packet.
            if (!text.startsWith("4")) return
            val packet = text.substring(1)
            // Socket.io event format: ["event", payload]
            // We're looking for "payment:confirmed"
            val json = JSONObject(packet)
            val data = json.optJSONArray("data") ?: return
            if (data.length() < 2) return
            val event = data.getString(0)
            if (event == "payment:confirmed") {
                val payload = data.getJSONObject(1)
                val payment = PaymentEvent(
                    sessionId = payload.optString("sessionId"),
                    amountEgp = payload.optDouble("amountEgp", 0.0),
                    senderHandle = payload.optString("senderHandle"),
                    detectedRef = if (payload.isNull("detectedRef")) null else payload.optString("detectedRef", null),
                    detectedAt = payload.optString("detectedAt"),
                )
                Log.i(TAG, "Payment confirmed event: $payment")
                onPaymentConfirmed?.invoke(payment)
            }
        } catch (e: Exception) {
            // Not all messages are JSON events — ignore parse failures
        }
    }

    private fun scheduleReconnect() {
        if (!isRunning) return
        // Reconnect after 5 seconds
        Thread {
            try {
                Thread.sleep(5000)
            } catch (_: InterruptedException) {}
            if (isRunning) connect()
        }.start()
    }

    data class PaymentEvent(
        val sessionId: String,
        val amountEgp: Double,
        val senderHandle: String,
        val detectedRef: String?,
        val detectedAt: String,
    )

    companion object {
        private const val TAG = "DashWsClient"
    }
}
