package com.instapaydetector.app

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class HistoryNotification(
    val id: String,
    val type: String, // PAYMENT | SYSTEM | WARNING | SUBSCRIPTION
    val title: String,
    val body: String,
    val timestamp: Long,
    var isRead: Boolean = false,
    val amountEgp: Double? = null,
    val senderHandle: String? = null,
    val reference: String? = null,
    val rawText: String? = null
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("type", type)
        put("title", title)
        put("body", body)
        put("timestamp", timestamp)
        put("isRead", isRead)
        amountEgp?.let { put("amountEgp", it) }
        senderHandle?.let { put("senderHandle", it) }
        reference?.let { put("reference", it) }
        rawText?.let { put("rawText", it) }
    }

    companion object {
        fun fromJson(json: JSONObject): HistoryNotification = HistoryNotification(
            id = json.optString("id", System.currentTimeMillis().toString()),
            type = json.optString("type", "PAYMENT"),
            title = json.optString("title", "Notification"),
            body = json.optString("body", ""),
            timestamp = json.optLong("timestamp", System.currentTimeMillis()),
            isRead = json.optBoolean("isRead", false),
            amountEgp = if (json.has("amountEgp")) json.optDouble("amountEgp") else null,
            senderHandle = json.optString("senderHandle").ifEmpty { null },
            reference = json.optString("reference").ifEmpty { null },
            rawText = json.optString("rawText").ifEmpty { null }
        )
    }
}

class NotificationHistoryManager private constructor(private val context: Context) {

    private val historyFile = File(context.filesDir, "notifications_history.json")
    private val maxItems = 200

    @Synchronized
    fun addNotification(
        type: String,
        title: String,
        body: String,
        amountEgp: Double? = null,
        senderHandle: String? = null,
        reference: String? = null,
        rawText: String? = null
    ) {
        val item = HistoryNotification(
            id = "${System.currentTimeMillis()}_${(100..999).random()}",
            type = type,
            title = title,
            body = body,
            timestamp = System.currentTimeMillis(),
            isRead = false,
            amountEgp = amountEgp,
            senderHandle = senderHandle,
            reference = reference,
            rawText = rawText
        )
        val list = getHistory().toMutableList()
        list.add(0, item)
        if (list.size > maxItems) {
            list.removeAt(list.size - 1)
        }
        saveHistory(list)
        Log.d(TAG, "Notification added to history: ${item.title}")
    }

    @Synchronized
    fun getHistory(): List<HistoryNotification> {
        if (!historyFile.exists()) return emptyList()
        return try {
            val content = historyFile.readText()
            val array = JSONArray(content)
            val list = mutableListOf<HistoryNotification>()
            for (i in 0 until array.length()) {
                list.add(HistoryNotification.fromJson(array.getJSONObject(i)))
            }
            list
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read notification history: ${e.message}")
            emptyList()
        }
    }

    @Synchronized
    fun getUnreadCount(): Int {
        return getHistory().count { !it.isRead }
    }

    @Synchronized
    fun markAllRead() {
        val list = getHistory().map { it.copy(isRead = true) }
        saveHistory(list)
    }

    @Synchronized
    fun markRead(id: String) {
        val list = getHistory().map {
            if (it.id == id) it.copy(isRead = true) else it
        }
        saveHistory(list)
    }

    @Synchronized
    fun clear() {
        if (historyFile.exists()) {
            historyFile.delete()
        }
    }

    private fun saveHistory(list: List<HistoryNotification>) {
        try {
            val array = JSONArray()
            list.forEach { array.put(it.toJson()) }
            historyFile.writeText(array.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save notification history: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "NotifHistoryMgr"

        @Volatile
        private var instance: NotificationHistoryManager? = null

        fun get(ctx: Context): NotificationHistoryManager =
            instance ?: synchronized(this) {
                instance ?: NotificationHistoryManager(ctx.applicationContext).also { instance = it }
            }
    }
}
