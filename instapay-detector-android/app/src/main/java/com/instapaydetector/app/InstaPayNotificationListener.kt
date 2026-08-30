package com.instapaydetector.app

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.Date
import java.util.Locale
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

    private val forwardedEventIds = LinkedHashMap<String, Long>()

    override fun onCreate() {
        super.onCreate()
        gatewayClient = GatewayClient(this)
        Log.i(TAG, "Listener service created. Monitoring $monitoredPackage")
        OfflineQueueManager.get(this).triggerFlush()
        MerchantNotificationPoller.start(this)
        MerchantNotificationPoller.pollNow(this)
        MerchantNotificationService.start(this)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        isConnected = true
        Log.i(TAG, "Listener connected — notification access granted.")
        postForegroundStatusNotification(true)
        OfflineQueueManager.get(this).triggerFlush()
        MerchantNotificationPoller.start(this)
        MerchantNotificationPoller.pollNow(this)
        MerchantNotificationService.start(this)
    }

    override fun onListenerDisconnected() {
        isConnected = false
        Log.w(TAG, "Listener disconnected — notification access was revoked.")
        postForegroundStatusNotification(false)
        super.onListenerDisconnected()
    }

    override fun onDestroy() {
        super.onDestroy()
        isConnected = false
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        if (sbn.packageName != monitoredPackage) return

        val notification = sbn.notification ?: return
        val payload = buildPayload(sbn, notification) ?: return

        val duplicateKey = payload.dedupeKey
        val lastForwarded = forwardedEventIds[duplicateKey]
        if (lastForwarded != null && lastForwarded >= sbn.postTime - 15_000L) {
            return
        }

        val config = GatewayConfig.get(this)
        if (payload.confidence < MIN_FORWARD_CONFIDENCE) {
            Log.i(TAG, "Ignoring low-confidence InstaPay notification (confidence=${payload.confidence}, text=${payload.rawText})")
            return
        }

        forwardedEventIds[duplicateKey] = sbn.postTime
        pruneMap(forwardedEventIds, 100, 24 * 60 * 60 * 1000L)

        val isoTimestamp = Date(sbn.postTime).toInstant().toString()
        Log.i(
            TAG,
            "Detected InstaPay payment: amount=${payload.amount}, sender=${payload.senderHandle}, ref=${payload.reference}, confidence=${payload.confidence}"
        )

        // Record to local Notification History
        try {
            NotificationHistoryManager.get(this).addNotification(
                type = "PAYMENT",
                title = "Payment Detected: +${String.format(Locale.US, "%.2f", payload.amount)} EGP",
                body = "From ${payload.senderHandle ?: "Customer"} • Ref: ${payload.reference ?: "N/A"}",
                amountEgp = payload.amount,
                senderHandle = payload.senderHandle,
                reference = payload.reference,
                rawText = payload.rawText
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to record to NotificationHistoryManager: ${e.message}")
        }

        scope.launch {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "InstaPayDetector::ReportWakeLock")
            try {
                wakeLock.acquire(15_000L) // Keep CPU awake for up to 15 seconds
            } catch (e: Exception) {
                Log.w(TAG, "Failed to acquire wake lock: ${e.message}")
            }

            try {
                val result = gatewayClient.reportPayment(
                    amountEgp = payload.amount,
                    senderHandle = payload.senderHandle,
                    recipientHandle = config.merchantHandle,
                    reference = payload.reference,
                    notificationTimestampIso = isoTimestamp,
                    rawNotificationText = payload.rawText,
                    notificationTitle = payload.title,
                    sourcePackage = sbn.packageName,
                    confidence = payload.confidence
                )

                if (result == ReportResult.ERROR) {
                    Log.w(TAG, "Webhook POST failed — enqueueing report to OfflineQueueManager.")
                    OfflineQueueManager.get(this@InstaPayNotificationListener).enqueue(
                        OfflineQueueManager.QueuedReport(
                            id = payload.dedupeKey,
                            amountEgp = payload.amount,
                            senderHandle = payload.senderHandle,
                            recipientHandle = config.merchantHandle,
                            reference = payload.reference,
                            timestampIso = isoTimestamp,
                            rawNotificationText = payload.rawText,
                            notificationTitle = payload.title,
                            sourcePackage = sbn.packageName,
                            confidence = payload.confidence
                        )
                    )
                } else if (result == ReportResult.SUBSCRIPTION_ENDED) {
                    Log.e(TAG, "Subscription/Trial ended. Webhook rejected payment.")
                    postErrorNotification("Subscription Ended", "Your free trial or subscription has ended. Payments are no longer being forwarded.")
                } else {
                    Log.i(TAG, "Webhook POST ok=true")
                }
            } finally {
                try {
                    if (wakeLock.isHeld) {
                        wakeLock.release()
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to release wake lock: ${e.message}")
                }
            }
        }
    }

    private fun postErrorNotification(title: String, text: String) {
        val channel = "instapay_detector_error"
        val mgr = NotificationManagerCompat.from(this)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = android.app.NotificationChannel(
                channel,
                "Detector Errors",
                android.app.NotificationManager.IMPORTANCE_HIGH
            )
            mgr.createNotificationChannel(ch)
        }

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_ipn_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        try {
            mgr.notify(System.currentTimeMillis().toInt(), notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Cannot post error notification: ${e.message}")
        }
    }

    private fun extractNotificationText(notification: Notification): NotificationPayload? {
        val extras = notification.extras ?: return null
        val parts = mutableListOf<CharSequence>()

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        extras.getCharSequence(Notification.EXTRA_TITLE)?.let { parts.add(it) }
        extras.getCharSequence(Notification.EXTRA_TEXT)?.let { parts.add(it) }
        extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.let { parts.add(it) }
        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.let { lines ->
            lines.forEach { parts.add(it) }
        }

        val combined = parts.joinToString(separator = " \n ") { it.toString() }.trim()
        return combined.ifBlank { null }?.let { raw ->
            NotificationPayload(
                rawText = raw,
                title = title.ifBlank { null },
                canonicalText = normalizeText(raw)
            )
        }
    }

    private fun buildPayload(sbn: StatusBarNotification, notification: Notification): ParsedPayment? {
        val extracted = extractNotificationText(notification) ?: return null
        val text = extracted.canonicalText
        if (!looksLikeInstaPayPayment(text)) return null

        val amount = extractAmount(text) ?: return null
        val sender = extractSender(text) ?: return null
        val confidence = computeConfidence(text, amount, sender, extracted.title)
        val reference = extractReference(text)
        val dedupeKey = buildDedupeKey(
            sbn.packageName,
            extracted.title,
            text,
            amount,
            sender
        )

        return ParsedPayment(
            amount = amount,
            senderHandle = sender,
            reference = reference,
            rawText = extracted.rawText,
            title = extracted.title,
            confidence = confidence,
            dedupeKey = dedupeKey
        )
    }

    private fun looksLikeInstaPayPayment(text: String): Boolean {
        if (ARABIC_EXACT_RECEIVED_PATTERN.matcher(text).find()) return true
        if (ENGLISH_EXACT_RECEIVED_PATTERN.matcher(text).find()) return true
        if (NEGATIVE_PATTERNS.any { it.matcher(text).find() }) return false
        return POSITIVE_PATTERNS.any { it.matcher(text).find() }
    }

    private fun extractAmount(text: String): Double? {
        ARABIC_EXACT_RECEIVED_PATTERN.matcher(text).let { match ->
            if (match.find()) {
                val raw = match.group(1) ?: return@let
                val normalized = normalizeDigits(raw).replace(",", "").trim()
                normalized.toDoubleOrNull()?.let { value ->
                    if (value > 0.0) return value
                }
            }
        }
        AMOUNT_PATTERNS.forEach { pattern ->
            val match = pattern.matcher(text)
            if (match.find()) {
                val raw = match.group(1) ?: return@forEach
                val normalized = normalizeDigits(raw).replace(",", "").trim()
                normalized.toDoubleOrNull()?.let { value ->
                    if (value > 0.0) return value
                }
            }
        }
        return null
    }

    private fun extractSender(text: String): String? {
        ARABIC_EXACT_RECEIVED_PATTERN.matcher(text).let { match ->
            if (match.find()) {
                val sender = match.group(2)?.trim().orEmpty()
                val normalized = sender.lowercase()
                if (normalized.isNotBlank()) return normalized
            }
        }
        SENDER_PATTERNS.forEach { pattern ->
            val match = pattern.matcher(text)
            if (match.find()) {
                val sender = match.group(1)?.trim().orEmpty()
                val normalized = sender.lowercase()
                if (normalized.isNotBlank()) return normalized
            }
        }
        return null
    }

    private fun extractReference(text: String): String? {
        REFERENCE_PATTERNS.forEach { pattern ->
            val m = pattern.matcher(text)
            if (m.find()) {
                val ref = m.group(1)?.uppercase()?.trim()
                if (!ref.isNullOrBlank()) return ref
            }
        }
        return null
    }

    private fun computeConfidence(text: String, amount: Double, sender: String, title: String?): Int {
        var score = 0
        if (ARABIC_EXACT_RECEIVED_PATTERN.matcher(text).find()) score += 60
        if (ENGLISH_EXACT_RECEIVED_PATTERN.matcher(text).find()) score += 55
        if (POSITIVE_PATTERNS.any { it.matcher(text).find() }) score += 45
        if (AMOUNT_PATTERNS.any { it.matcher(text).find() }) score += 20
        if (SENDER_PATTERNS.any { it.matcher(text).find() }) score += 20
        if (text.contains("@instapay")) score += 10
        if (title?.contains("instapay", ignoreCase = true) == true) score += 5
        if (amount >= 1.0) score += 0
        if (sender.isNotBlank()) score += 0
        return score.coerceIn(0, 100)
    }

    private fun buildDedupeKey(
        packageName: String,
        title: String?,
        text: String,
        amount: Double,
        sender: String
    ): String {
        val source = listOf(packageName, title.orEmpty(), text, amount.toString(), sender).joinToString("|")
        val digest = MessageDigest.getInstance("SHA-256").digest(source.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun pruneMap(map: LinkedHashMap<String, Long>, maxSize: Int, maxAgeMs: Long) {
        val cutoff = System.currentTimeMillis() - maxAgeMs
        map.entries.removeAll { it.value < cutoff }
        while (map.size > maxSize) {
            val firstKey = map.entries.iterator().next().key
            map.remove(firstKey)
        }
    }

    private fun normalizeText(input: String): String {
        return normalizeDigits(input)
            .replace('\u00A0', ' ')
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun normalizeDigits(input: String): String {
        val builder = StringBuilder(input.length)
        for (ch in input) {
            builder.append(
                when (ch) {
                    '٠' -> '0'
                    '١' -> '1'
                    '٢' -> '2'
                    '٣' -> '3'
                    '٤' -> '4'
                    '٥' -> '5'
                    '٦' -> '6'
                    '٧' -> '7'
                    '٨' -> '8'
                    '٩' -> '9'
                    else -> ch
                }
            )
        }
        return builder.toString()
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
            .setSmallIcon(R.drawable.ic_ipn_notification)
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

    private data class NotificationPayload(
        val rawText: String,
        val title: String?,
        val canonicalText: String,
    )

    private data class ParsedPayment(
        val amount: Double,
        val senderHandle: String,
        val reference: String?,
        val rawText: String,
        val title: String?,
        val confidence: Int,
        val dedupeKey: String
    )

    companion object {
        private const val TAG = "InstaPayListener"
        private const val STATUS_NOTIFICATION_ID = 4242
        private const val MIN_FORWARD_CONFIDENCE = 60

        @Volatile
        var isConnected: Boolean = false

        private val ARABIC_EXACT_RECEIVED_PATTERN = Pattern.compile(
            "لقد\\s+استلمت\\s+([0-9٠-٩]+(?:[\\.,][0-9٠-٩]+)*)\\s*(?:جنيه|ج\\.م|جنيهًا)?\\s*من\\s+([a-z0-9_.\\-]+@instapay)",
            Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
        )

        private val ENGLISH_EXACT_RECEIVED_PATTERN = Pattern.compile(
            "(?:you\\s+have\\s+received|received)\\s+([0-9٠-٩]+(?:[\\.,][0-9٠-٩]+)*)\\s*(?:egp|le|l\\.e\\.|ج\\.م\\.?|جنيه|جنيهًا)?\\s*(?:from)\\s+([a-z0-9_.\\-]+@instapay)",
            Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
        )

        private val POSITIVE_PATTERNS = listOf(
            Pattern.compile("\\b(received|credited|deposit(?:ed)?|transfer(?:red)?|payment\\s+received|money\\s+received)\\b", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE),
            Pattern.compile("(استلمت|تم\\s+استلام|وصلتك|تم\\s+إيداع|تم\\s+تحويل|لقد\\s+استلمت)", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE)
        )

        private val NEGATIVE_PATTERNS = listOf(
            Pattern.compile("\\b(sent|paid|requested|declined|failed|cancel(?:led|ed)?|reversed|refunded|withdrawn)\\b", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE),
            Pattern.compile("(أرسلت|تم\\s+الإرسال|مرفوض|فشل|ملغي|تم\\s+استرداد|سحب)", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE)
        )

        private val AMOUNT_PATTERNS = listOf(
            Pattern.compile("(?:EGP|ج\\.م\\.?|جنيه(?:\\s*مصري)?|LE|L\\.E\\.)?\\s*([0-9٠-٩]+(?:[\\.,][0-9٠-٩]+)*)\\s*(?:EGP|ج\\.م\\.?|جنيه(?:\\s*مصري)?|LE|L\\.E\\.)?", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE),
            Pattern.compile("(?:received|credited|استلمت|تم\\s+استلام|وصلتك|إيداع|deposit(?:ed)?|لقد\\s+استلمت)[^0-9٠-٩]{0,12}([0-9٠-٩]+(?:[\\.,][0-9٠-٩]+)*)", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE)
        )

        private val SENDER_PATTERNS = listOf(
            Pattern.compile("(?:from|من|sender(?:\\s*:)?)\\s+([a-zA-Z0-9_.\\-@\\u0600-\\u06FF ]{2,64})", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE),
            Pattern.compile("([a-z0-9_.\\-]+@instapay)", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE)
        )

        private val REFERENCE_PATTERNS = listOf(
            Pattern.compile("(IPAY-[A-Z0-9]{6,})", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE),
            Pattern.compile("(TXN-[A-Z0-9]{6,})", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE),
            Pattern.compile("(REF-[A-Z0-9]{6,})", Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE)
        )

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
