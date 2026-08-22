package com.instapaydetector.app

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Manages persistent storage and background retries for failed webhook POST requests.
 *
 * If the device is offline or the server returns an error during payment detection,
 * the payment report is safely queued to disk and retried with exponential backoff
 * when connectivity is restored.
 */
class OfflineQueueManager private constructor(private val context: Context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queueFile = File(context.filesDir, "pending_webhooks_queue.json")
    private val isFlushing = AtomicBoolean(false)

    data class QueuedReport(
        val id: String,
        val amountEgp: Double,
        val senderHandle: String?,
        val recipientHandle: String?,
        val reference: String?,
        val timestampIso: String,
        val retries: Int = 0,
        val rawNotificationText: String? = null,
        val notificationTitle: String? = null,
        val sourcePackage: String? = null,
        val confidence: Int? = null
    ) {
        fun toJson(): JSONObject = JSONObject().apply {
            put("id", id)
            put("amountEgp", amountEgp)
            put("senderHandle", senderHandle ?: "")
            put("recipientHandle", recipientHandle ?: "")
            put("reference", reference ?: "")
            put("timestampIso", timestampIso)
            put("retries", retries)
            put("rawNotificationText", rawNotificationText ?: "")
            put("notificationTitle", notificationTitle ?: "")
            put("sourcePackage", sourcePackage ?: "")
            confidence?.let { put("confidence", it) }
        }

        companion object {
            fun fromJson(json: JSONObject): QueuedReport = QueuedReport(
                id = json.optString("id", System.currentTimeMillis().toString()),
                amountEgp = json.optDouble("amountEgp", 0.0),
                senderHandle = json.optString("senderHandle").ifEmpty { null },
                recipientHandle = json.optString("recipientHandle").ifEmpty { null },
                reference = json.optString("reference").ifEmpty { null },
                timestampIso = json.optString("timestampIso", ""),
                retries = json.optInt("retries", 0),
                rawNotificationText = json.optString("rawNotificationText").ifEmpty { null },
                notificationTitle = json.optString("notificationTitle").ifEmpty { null },
                sourcePackage = json.optString("sourcePackage").ifEmpty { null },
                confidence = if (json.has("confidence")) json.optInt("confidence") else null
            )
        }
    }

    @Synchronized
    fun enqueue(report: QueuedReport) {
        val current = loadQueue()
        current.add(report)
        saveQueue(current)
        Log.i(TAG, "Queued offline webhook report (id=${report.id}, queue size=${current.size})")
        triggerFlush()
    }

    @Synchronized
    private fun loadQueue(): MutableList<QueuedReport> {
        if (!queueFile.exists()) return mutableListOf()
        return try {
            val content = queueFile.readText()
            val array = JSONArray(content)
            val list = mutableListOf<QueuedReport>()
            for (i in 0 until array.length()) {
                list.add(QueuedReport.fromJson(array.getJSONObject(i)))
            }
            list
        } catch (e: Exception) {
            Log.e(TAG, "Error reading offline queue: ${e.message}")
            mutableListOf()
        }
    }

    @Synchronized
    private fun saveQueue(list: List<QueuedReport>) {
        try {
            val array = JSONArray()
            list.forEach { array.put(it.toJson()) }
            queueFile.writeText(array.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Error saving offline queue: ${e.message}")
        }
    }

    fun triggerFlush() {
        if (!isFlushing.compareAndSet(false, true)) return

        scope.launch {
            try {
                var pending = loadQueue()
                val client = GatewayClient(context)

                while (pending.isNotEmpty()) {
                    val item = pending.first()
                    Log.i(TAG, "Attempting to flush queued report (id=${item.id}, attempt=${item.retries + 1})")

                    val result = client.reportPayment(
                        amountEgp = item.amountEgp,
                        senderHandle = item.senderHandle,
                        recipientHandle = item.recipientHandle,
                        reference = item.reference,
                        notificationTimestampIso = item.timestampIso,
                        rawNotificationText = item.rawNotificationText,
                        notificationTitle = item.notificationTitle,
                        sourcePackage = item.sourcePackage,
                        confidence = item.confidence
                    )

                    if (result == ReportResult.SUCCESS) {
                        Log.i(TAG, "Successfully flushed report id=${item.id}")
                        pending.removeAt(0)
                        saveQueue(pending)
                    } else if (result == ReportResult.SUBSCRIPTION_ENDED) {
                        Log.e(TAG, "Dropping report id=${item.id} because subscription/trial ended.")
                        pending.removeAt(0)
                        saveQueue(pending)
                    } else {
                        val updatedRetries = item.retries + 1
                        if (updatedRetries > 10) {
                            Log.w(TAG, "Dropping report id=${item.id} after 10 failed retries")
                            pending.removeAt(0)
                        } else {
                            pending[0] = item.copy(retries = updatedRetries)
                            saveQueue(pending)
                            // Exponential backoff: 2s, 4s, 8s, 16s... capped at 60s
                            val delayMs = (Math.pow(2.0, updatedRetries.toDouble()) * 1000).toLong().coerceAtMost(60_000L)
                            Log.i(TAG, "Backing off for ${delayMs}ms before retrying queue")
                            delay(delayMs)
                        }
                    }
                    pending = loadQueue()
                }
            } finally {
                isFlushing.set(false)
            }
        }
    }

    companion object {
        private const val TAG = "OfflineQueueManager"

        @Volatile
        private var instance: OfflineQueueManager? = null

        fun get(ctx: Context): OfflineQueueManager =
            instance ?: synchronized(this) {
                instance ?: OfflineQueueManager(ctx.applicationContext).also { instance = it }
            }
    }
}
