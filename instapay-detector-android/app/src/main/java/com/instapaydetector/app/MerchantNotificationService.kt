package com.instapaydetector.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class MerchantNotificationService : Service() {
    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        startForeground(FOREGROUND_ID, buildForegroundNotification())
        MerchantNotificationPoller.start(this)
        MerchantNotificationPoller.pollNow(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        MerchantNotificationPoller.start(this)
        MerchantNotificationPoller.pollNow(this)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildForegroundNotification(): android.app.Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_ipn_notification)
            .setContentTitle("Listening for InstaPay payments")
            .setContentText("Background sync is active for payment and admin notifications.")
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Detector background sync",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps detector payment and admin notification sync active"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val TAG = "MerchantNotifService"
        private const val CHANNEL_ID = "detector_background_sync"
        private const val FOREGROUND_ID = 4243

        fun start(context: Context) {
            if (!GatewayConfig.get(context.applicationContext).isLoggedIn) return
            try {
                val intent = Intent(context.applicationContext, MerchantNotificationService::class.java)
                ContextCompat.startForegroundService(context.applicationContext, intent)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to start foreground sync service: ${e.message}")
            }
        }

        fun stop(context: Context) {
            try {
                context.applicationContext.stopService(
                    Intent(context.applicationContext, MerchantNotificationService::class.java)
                )
            } catch (e: Exception) {
                Log.w(TAG, "Failed to stop foreground sync service: ${e.message}")
            }
        }
    }
}
