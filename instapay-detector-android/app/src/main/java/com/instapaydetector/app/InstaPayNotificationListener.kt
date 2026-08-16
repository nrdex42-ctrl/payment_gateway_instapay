package com.instapaydetector.app

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.Date
import java.util.regex.Pattern

/**
 * Listens for notifications posted by the official InstaPay Egypt app
 * (package: com.egyptianbanks.instapay) and forwards parsed payment events
 * to the gateway webhook.
 *
 * Two modes:
 *
 * 1. MERCHANT mode (default) — runs on the merchant's phone. Forwards
 *    "You have received X EGP from <local>@instapay" notifications so the
 *    gateway can match them against pending client checkouts and confirm them.
 *
 * 2. CLIENT mode (optional, belt-and-suspenders) — runs on the client's phone.
 *    Forwards "You have sent X EGP to <local>@instapay" notifications as a
 *    secondary confirmation signal. This is useful when the merchant's detector
 *    is offline or delayed — the client's own "sent" notification can also
 *    trigger the webhook. The gateway treats both directions the same way
 *    (matches by senderHandle + amountEgp).
 *
 * Requires the user to manually grant Notification access in Android Settings:
 *   Settings → Apps → Special access → Notification access → InstaPay Detector → On
 *
 * Notes:
 * - We only inspect notifications whose `packageName` is exactly InstaPay's.
 * - We never log or transmit the full notification text to any third party
 *   other than the gateway configured in the app settings.
 * - We deduplicate by notification key + postTime so a single transfer that
 *   triggers multiple updates only fires one webhook call.
 */
class InstaPayNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var gatewayClient: GatewayClient

    // The official InstaPay Egypt app package on the Google Play Store.
    private val monitoredPackage = "com.egyptianbanks.instapay"

    // Match English: "You have received 1.00 EGP from mohammedshabana777@instapay"
    // Match Arabic: "لقد استلمت 1.00 ج.م من mohammedshabana777@instapay" or "تم استلام 1.00 جنيه من ..."
    private val receivedPatterns = listOf(
        Pattern.compile("(?:received|استلمت|استلام)\\s+([0-9]+(?:\\.[0-9]{1,2})?)\\s*(?:egp|ج\\.م|جنيه)?\\s*(?:from|من)\\s+([a-z0-9_.\\-]+@instapay)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("received\\s+([0-9]+(?:\\.[0-9]{1,2})?)\\s*egp\\s+from\\s+([a-z0-9_.\\-]+@instapay)", Pattern.CASE_INSENSITIVE)
    )

    // Match English: "You have sent 1.00 EGP to mohammedshabana77@instapay"
    // Match Arabic: "تم تحويل 1.00 ج.م إلى mohammedshabana77@instapay" or "لقد أرسلت 1.00 ج.م إلى ..."
    private val sentPatterns = listOf(
        Pattern.compile("(?:sent|تحويل|أرسلت|أرسل)\\s+([0-9]+(?:\\.[0-9]{1,2})?)\\s*(?:egp|ج\\.م|جنيه)?\\s*(?:to|إلى|الي)\\s+([a-z0-9_.\\-]+@instapay)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:have\\s+)?sent\\s+([0-9]+(?:\\.[0-9]{1,2})?)\\s*egp\\s+to\\s+([a-z0-9_.\\-]+@instapay)", Pattern.CASE_INSENSITIVE)
    )

    // Optional: InstaPay reference code pattern
    private val referencePattern: Pattern = Pattern.compile(
        "(IPAY-[A-Z0-9]{6,})",
        Pattern.CASE_INSENSITIVE
    )

    // Tracks the postTime of the last notification we forwarded
    private val forwardedKeys = mutableMapOf<String, Long>()

    override fun onCreate() {
        super.onCreate()
        gatewayClient = GatewayClient(this)
        val mode = GatewayConfig.get(this).detectorMode
        Log.i(TAG, "Listener service created (mode=$mode). Monitoring $monitoredPackage")
        // Flush any offline pending queue on startup
        OfflineQueueManager.get(this).triggerFlush()
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "Listener connected — notification access granted.")
        postForegroundStatusNotification(true)
        OfflineQueueManager.get(this).triggerFlush()
    }

    override fun onListenerDisconnected() {
        Log.w(TAG, "Listener disconnected — notification access was revoked.")
        postForegroundStatusNotification(false)
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        if (sbn.packageName != monitoredPackage) return

        val notification = sbn.notification ?: return
        val text = extractNotificationText(notification) ?: return
        val key = sbn.key ?: sbn.toString()

        val lastForwarded = forwardedKeys[key]
        if (lastForwarded != null && lastForwarded == sbn.postTime) {
            return
        }

        val config = GatewayConfig.get(this)
        val parsed = parseNotification(text, config.detectorMode) ?: return

        if (parsed.direction == PaymentDirection.RECEIVED && config.detectorMode == DetectorMode.CLIENT) {
            return
        }
        if (parsed.direction == PaymentDirection.SENT && config.detectorMode == DetectorMode.MERCHANT) {
            return
        }

        forwardedKeys[key] = sbn.postTime
        if (forwardedKeys.size > 50) {
            val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000
            forwardedKeys.entries.removeAll { it.value < cutoff }
        }

        val isoTimestamp = Date(sbn.postTime).toInstant().toString()
        Log.i(
            TAG,
            "Detected InstaPay ${parsed.direction}: amount=${parsed.amount}, " +
                "counterparty=${parsed.counterpartyHandle}, ref=${parsed.reference}"
        )

        scope.launch {
            val senderHandle: String?
            val recipientHandle: String?

            when (parsed.direction) {
                PaymentDirection.RECEIVED -> {
                    senderHandle = parsed.counterpartyHandle
                    recipientHandle = config.merchantHandle
                }
                PaymentDirection.SENT -> {
                    senderHandle = config.myHandle
                    recipientHandle = parsed.counterpartyHandle
                    if (senderHandle.isNullOrBlank()) {
                        Log.w(TAG, "Client mode: missing myHandle, skipping SENT report.")
                        return@launch
                    }
                }
            }

            val ok = gatewayClient.reportPayment(
                amountEgp = parsed.amount,
                senderHandle = senderHandle,
                recipientHandle = recipientHandle,
                reference = parsed.reference,
                notificationTimestampIso = isoTimestamp
            )

            if (!ok) {
                Log.w(TAG, "Webhook POST failed — enqueueing report to OfflineQueueManager for auto-retry.")
                OfflineQueueManager.get(this@InstaPayNotificationListener).enqueue(
                    OfflineQueueManager.QueuedReport(
                        id = System.currentTimeMillis().toString(),
                        amountEgp = parsed.amount,
                        senderHandle = senderHandle,
                        recipientHandle = recipientHandle,
                        reference = parsed.reference,
                        timestampIso = isoTimestamp
                    )
                )
            } else {
                Log.i(TAG, "Webhook POST ok=true")
            }
        }
    }

    /** Extracts the visible text of a notification (title + text + bigText). */
    private fun extractNotificationText(notification: Notification): String? {
        val extras = notification.extras ?: return null
        val parts = mutableListOf<CharSequence>()

        extras.getCharSequence(Notification.EXTRA_TITLE)?.let { parts.add(it) }
        extras.getCharSequence(Notification.EXTRA_TEXT)?.let { parts.add(it) }
        extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.let { parts.add(it) }
        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.let { lines ->
            lines.forEach { parts.add(it) }
        }

        val combined = parts.joinToString(separator = " \n ") { it.toString() }
        return combined.ifBlank { null }
    }

    private fun parseNotification(text: String, mode: DetectorMode): ParsedPayment? {
        if (mode == DetectorMode.MERCHANT) {
            for (pattern in receivedPatterns) {
                val m = pattern.matcher(text)
                if (m.find()) {
                    val amount = m.group(1)?.toDoubleOrNull() ?: continue
                    val sender = m.group(2)?.lowercase()?.trim() ?: continue
                    return ParsedPayment(
                        direction = PaymentDirection.RECEIVED,
                        amount = amount,
                        counterpartyHandle = sender,
                        reference = extractReference(text)
                    )
                }
            }
        }

        if (mode == DetectorMode.CLIENT) {
            for (pattern in sentPatterns) {
                val m = pattern.matcher(text)
                if (m.find()) {
                    val amount = m.group(1)?.toDoubleOrNull() ?: continue
                    val recipient = m.group(2)?.lowercase()?.trim() ?: continue
                    return ParsedPayment(
                        direction = PaymentDirection.SENT,
                        amount = amount,
                        counterpartyHandle = recipient,
                        reference = extractReference(text)
                    )
                }
            }
        }

        return null
    }

    private fun extractReference(text: String): String? {
        val m = referencePattern.matcher(text)
        return if (m.find()) m.group(1)?.uppercase() else null
    }

    /** Posts a low-priority foreground-style notification so the merchant can
     *  see at a glance whether the detector is currently listening. */
    private fun postForegroundStatusNotification(connected: Boolean) {
        val channel = "instapay_detector_status"
        val mgr = NotificationManagerCompat.from(this)
        val config = GatewayConfig.get(this)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = android.app.NotificationChannel(
                channel,
                "Detector status",
                android.app.NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows whether the InstaPay detector is listening"
                setShowBadge(false)
            }
            mgr.createNotificationChannel(ch)
        }

        val title = if (connected) "Listening for InstaPay payments" else "Detector offline"
        val text = if (connected) {
            when (config.detectorMode) {
                DetectorMode.MERCHANT -> "Merchant mode · auto-confirming payments to ${config.merchantHandle}"
                DetectorMode.CLIENT -> "Client mode · reporting sent payments to the gateway"
            }
        } else {
            "Open the app and grant notification access to resume."
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()

        try {
            mgr.notify(STATUS_NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Cannot post status notification: ${e.message}")
        }
    }

    private data class ParsedPayment(
        val direction: PaymentDirection,
        val amount: Double,
        val counterpartyHandle: String,
        val reference: String?
    )

    private enum class PaymentDirection { RECEIVED, SENT }

    companion object {
        private const val TAG = "InstaPayListener"
        private const val STATUS_NOTIFICATION_ID = 4242

        /**
         * Returns true if the user has granted notification-listener access
         * to this app. Used by MainActivity to show the permission status.
         */
        fun isPermissionGranted(context: Context): Boolean {
            val flat = android.provider.Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners"
            ) ?: return false
            val componentName = context.packageName + "/" + InstaPayNotificationListener::class.java.name
            return flat.split(":").any { it.equals(componentName, ignoreCase = true) }
        }
    }
}
