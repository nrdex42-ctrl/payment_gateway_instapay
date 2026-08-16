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
 * Runs on the client's phone. Forwards "You have received X EGP from <local>@instapay"
 * notifications so the gateway can confirm the pending customer checkout.
 *
 * Requires the user to manually grant Notification access in Android Settings.
 */
class InstaPayNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var gatewayClient: GatewayClient

    private val monitoredPackage = "com.egyptianbanks.instapay"

    // Match English/Arabic received notifications
    private val receivedPatterns = listOf(
        Pattern.compile("(?:received|استلمت|استلام)\\s+([0-9]+(?:\\.[0-9]{1,2})?)\\s*(?:egp|ج\\.م|جنيه)?\\s*(?:from|من)\\s+([a-z0-9_.\\-]+@instapay)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("received\\s+([0-9]+(?:\\.[0-9]{1,2})?)\\s*egp\\s+from\\s+([a-z0-9_.\\-]+@instapay)", Pattern.CASE_INSENSITIVE)
    )

    private val referencePattern: Pattern = Pattern.compile(
        "(IPAY-[A-Z0-9]{6,})",
        Pattern.CASE_INSENSITIVE
    )

    private val forwardedKeys = mutableMapOf<String, Long>()

    override fun onCreate() {
        super.onCreate()
        gatewayClient = GatewayClient(this)
        Log.i(TAG, "Listener service created. Monitoring $monitoredPackage")
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
        val parsed = parseNotification(text) ?: return

        forwardedKeys[key] = sbn.postTime
        if (forwardedKeys.size > 50) {
            val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000
            forwardedKeys.entries.removeAll { it.value < cutoff }
        }

        val isoTimestamp = Date(sbn.postTime).toInstant().toString()
        Log.i(
            TAG,
            "Detected InstaPay payment: amount=${parsed.amount}, sender=${parsed.senderHandle}, ref=${parsed.reference}"
        )

        scope.launch {
            val ok = gatewayClient.reportPayment(
                amountEgp = parsed.amount,
                senderHandle = parsed.senderHandle,
                recipientHandle = config.merchantHandle,
                reference = parsed.reference,
                notificationTimestampIso = isoTimestamp
            )

            if (!ok) {
                Log.w(TAG, "Webhook POST failed — enqueueing report to OfflineQueueManager.")
                OfflineQueueManager.get(this@InstaPayNotificationListener).enqueue(
                    OfflineQueueManager.QueuedReport(
                        id = System.currentTimeMillis().toString(),
                        amountEgp = parsed.amount,
                        senderHandle = parsed.senderHandle,
                        recipientHandle = config.merchantHandle,
                        reference = parsed.reference,
                        timestampIso = isoTimestamp
                    )
                )
            } else {
                Log.i(TAG, "Webhook POST ok=true")
            }
        }
    }

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

    private fun parseNotification(text: String): ParsedPayment? {
        for (pattern in receivedPatterns) {
            val m = pattern.matcher(text)
            if (m.find()) {
                val amount = m.group(1)?.toDoubleOrNull() ?: continue
                val sender = m.group(2)?.lowercase()?.trim() ?: continue
                return ParsedPayment(
                    amount = amount,
                    senderHandle = sender,
                    reference = extractReference(text)
                )
            }
        }
        return null
    }

    private fun extractReference(text: String): String? {
        val m = referencePattern.matcher(text)
        return if (m.find()) m.group(1)?.uppercase() else null
    }

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
            "Active · auto-confirming payments to ${config.merchantHandle}"
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
        val amount: Double,
        val senderHandle: String,
        val reference: String?
    )

    companion object {
        private const val TAG = "InstaPayListener"
        private const val STATUS_NOTIFICATION_ID = 4242

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
