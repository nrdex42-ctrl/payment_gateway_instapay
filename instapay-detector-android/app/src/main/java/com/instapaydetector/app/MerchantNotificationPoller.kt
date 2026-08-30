package com.instapaydetector.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

object MerchantNotificationPoller {
    private const val TAG = "MerchantNotifPoller"
    private const val CHANNEL_ID = "merchant_messages"
    private const val POLL_INTERVAL_MS = 60_000L

    private val started = AtomicBoolean(false)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun start(context: Context) {
        val appContext = context.applicationContext
        if (!GatewayConfig.get(appContext).isLoggedIn) return
        if (!started.compareAndSet(false, true)) return

        ensureChannel(appContext)
        scope.launch {
            Log.i(TAG, "Merchant notification background poller started")
            while (true) {
                pollOnce(appContext)
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    fun pollNow(context: Context) {
        val appContext = context.applicationContext
        if (!GatewayConfig.get(appContext).isLoggedIn) return
        ensureChannel(appContext)
        scope.launch { pollOnce(appContext) }
    }

    private suspend fun pollOnce(context: Context) {
        try {
            val config = GatewayConfig.get(context)
            if (!config.isLoggedIn) return

            // 1. Flush offline transactions periodically
            OfflineQueueManager.get(context).triggerFlush()

            // 2. Ensure notification listener is alive
            if (InstaPayNotificationListener.isPermissionGranted(context)) {
                if (!InstaPayNotificationListener.isConnected) {
                    Log.w(TAG, "Notification listener is disconnected but has permission. Forcing rebind via component toggle...")
                    try {
                        val pm = context.packageManager
                        val componentName = android.content.ComponentName(context, InstaPayNotificationListener::class.java)
                        pm.setComponentEnabledSetting(
                            componentName,
                            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                            PackageManager.DONT_KILL_APP
                        )
                        pm.setComponentEnabledSetting(
                            componentName,
                            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                            PackageManager.DONT_KILL_APP
                        )
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to toggle component state: ${e.message}")
                    }
                }
            }

            if (config.dashboardApiKey.isBlank() && config.authToken.isBlank()) return

            val apiClient = DashboardApiClient(context)
            try {
                apiClient.fetchDashboard()
            } catch (e: Exception) {
                Log.d(TAG, "Background dashboard sync: ${e.message}")
            }

            val notifications = apiClient.fetchNotifications().getOrElse { error ->
                Log.w(TAG, "Failed to fetch merchant notifications: ${error.message}")
                return
            }
            if (notifications.isEmpty()) return

            val postedIds = mutableListOf<String>()
            notifications.forEach { item ->
                // Record to local Notification History
                try {
                    NotificationHistoryManager.get(context).addNotification(
                        type = if (item.severity.equals("ERROR", ignoreCase = true) || item.severity.equals("WARNING", ignoreCase = true)) "WARNING" else "SYSTEM",
                        title = item.title,
                        body = item.message
                    )
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to record to NotificationHistoryManager: ${e.message}")
                }

                if (postNotification(context, item)) {
                    postedIds.add(item.id)
                }
            }

            if (postedIds.isNotEmpty()) {
                try {
                    apiClient.markNotificationsRead(postedIds)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to mark merchant notifications read: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Unhandled exception in pollOnce: ${e.message}")
        }
    }

    private fun postNotification(context: Context, item: MerchantNotification): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "POST_NOTIFICATIONS is not granted; keeping notification unread")
            return false
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            item.id.hashCode(),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val priority = when (item.severity.uppercase()) {
            "ERROR", "WARNING" -> NotificationCompat.PRIORITY_HIGH
            else -> NotificationCompat.PRIORITY_DEFAULT
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_ipn_notification)
            .setContentTitle(item.title)
            .setContentText(item.message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(item.message))
            .setAutoCancel(true)
            .setPriority(priority)
            .setContentIntent(pendingIntent)
            .build()

        return try {
            NotificationManagerCompat.from(context).notify(item.id.hashCode(), notification)
            true
        } catch (e: SecurityException) {
            Log.w(TAG, "Cannot post merchant notification: ${e.message}")
            false
        }
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Merchant messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Admin messages sent to the merchant detector app"
        }
        manager.createNotificationChannel(channel)
    }
}
