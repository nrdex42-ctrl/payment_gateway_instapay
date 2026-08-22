package com.instapaydetector.app

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

enum class ReportResult {
    SUCCESS,
    SUBSCRIPTION_ENDED,
    ERROR
}

/**
 * Sends a parsed InstaPay notification to the gateway webhook.
 *
 * Endpoint: POST {gatewayUrl}
 * Headers: Authorization: Bearer {authToken}
 *          Content-Type: application/json
 * Body: { "amountEgp": 1.00, "senderHandle": "ahmed@instapay", "reference": "...", "notificationTimestamp": "..." }
 *
 * Returns ReportResult indicating the outcome.
 */
class GatewayClient(ctx: Context) {

    private val config = GatewayConfig.get(ctx)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun reportPayment(
        amountEgp: Double,
        senderHandle: String?,
        recipientHandle: String?,
        reference: String?,
        notificationTimestampIso: String,
        rawNotificationText: String? = null,
        notificationTitle: String? = null,
        sourcePackage: String? = null,
        confidence: Int? = null
    ): ReportResult = withContext(Dispatchers.IO) {
        val url = config.gatewayUrl
        val token = config.authToken

        if (url.isBlank() || token.isBlank()) {
            Log.e(TAG, "Gateway URL or token is blank. Configure them in the app settings.")
            return@withContext ReportResult.ERROR
        }
        if (senderHandle.isNullOrBlank()) {
            Log.e(TAG, "senderHandle is blank — cannot report payment.")
            return@withContext ReportResult.ERROR
        }

        val payload = JSONObject().apply {
            put("amountEgp", amountEgp)
            put("senderHandle", senderHandle)
            if (!recipientHandle.isNullOrBlank()) put("recipientHandle", recipientHandle)
            if (!reference.isNullOrBlank()) put("reference", reference)
            put("notificationTimestamp", notificationTimestampIso)
            if (!rawNotificationText.isNullOrBlank()) put("rawNotificationText", rawNotificationText)
            if (!notificationTitle.isNullOrBlank()) put("notificationTitle", notificationTitle)
            if (!sourcePackage.isNullOrBlank()) put("sourcePackage", sourcePackage)
            confidence?.let { put("confidence", it) }
            // Backwards-compatible fallback text for existing server parsers.
            put("text", rawNotificationText ?: "You have received ${formatAmount(amountEgp)} EGP from $senderHandle")
        }

        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "InstaPayDetector/1.0 (Android)")
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        try {
            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                Log.i(
                    TAG,
                    "Webhook responded ${response.code}: $body (matched=${
                        try {
                            JSONObject(body).optBoolean("matched", false)
                        } catch (_: Exception) {
                            false
                        }
                    })"
                )
                if (response.code == 402 || response.code == 403) {
                    ReportResult.SUBSCRIPTION_ENDED
                } else if (response.isSuccessful) {
                    ReportResult.SUCCESS
                } else {
                    ReportResult.ERROR
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to POST to gateway webhook: ${e.message}", e)
            ReportResult.ERROR
        }
    }

    private fun formatAmount(amount: Double): String {
        return String.format("%.2f", amount)
    }

    companion object {
        private const val TAG = "GatewayClient"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
