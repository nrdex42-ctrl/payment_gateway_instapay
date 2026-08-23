package com.instapaydetector.app

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.util.Log

class DetectorStartupReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action.orEmpty()
        if (!InstaPayNotificationListener.isPermissionGranted(context)) {
            Log.i(TAG, "Notification listener access is not granted; skipping rebind for $action")
            return
        }

        requestListenerRebind(context, action)
        OfflineQueueManager.get(context.applicationContext).triggerFlush()
    }

    companion object {
        private const val TAG = "DetectorStartup"

        fun requestListenerRebind(context: Context, reason: String = "manual") {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    val component = ComponentName(context, InstaPayNotificationListener::class.java)
                    NotificationListenerService.requestRebind(component)
                    Log.i(TAG, "Requested notification-listener rebind: $reason")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to request notification-listener rebind: ${e.message}")
            }
        }
    }
}
