package com.instapaydetector.admin

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

object AdminNotificationHelper {

    const val CHANNEL_ID = "admin_merchant_signups"
    const val ACTION_REVIEW_PENDING = "com.instapaydetector.admin.ACTION_REVIEW_PENDING"
    private const val PREFS_NAME = "admin_notification_tracker"
    private const val KEY_NOTIFIED_IDS = "notified_pending_merchant_ids"

    fun initNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelName = context.getString(R.string.notification_channel_name)
            val channelDesc = context.getString(R.string.notification_channel_desc)
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, channelName, importance).apply {
                description = channelDesc
                enableLights(true)
                lightColor = context.getColor(R.color.brand_primary)
                enableVibration(true)
                setShowBadge(true)
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Inspects clients array and triggers status bar notification for any newly discovered pending merchant.
     * Returns the total count of pending merchants.
     */
    fun processPendingMerchants(context: Context, clientsArray: JSONArray): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val notifiedIds = prefs.getStringSet(KEY_NOTIFIED_IDS, mutableSetOf())?.toMutableSet() ?: mutableSetOf()

        var pendingCount = 0
        val currentPendingIds = mutableSetOf<String>()

        for (i in 0 until clientsArray.length()) {
            val client = clientsArray.optJSONObject(i) ?: continue
            val approvalStatus = client.optString("approvalStatus", "APPROVED").uppercase()
            if (approvalStatus == "PENDING") {
                pendingCount++
                val id = client.optString("id")
                currentPendingIds.add(id)

                if (!notifiedIds.contains(id)) {
                    // New pending signup detected! Post status bar notification
                    showNewMerchantNotification(context, client)
                    notifiedIds.add(id)
                }
            }
        }

        // Clean up notified set for merchants that are no longer pending
        notifiedIds.retainAll(currentPendingIds)
        prefs.edit().putStringSet(KEY_NOTIFIED_IDS, notifiedIds).apply()

        return pendingCount
    }

    fun showNewMerchantNotification(context: Context, merchant: JSONObject) {
        if (!hasNotificationPermission(context)) return

        initNotificationChannel(context)

        val id = merchant.optString("id")
        val businessName = merchant.optString("businessName", "New Merchant")
        val handle = merchant.optString("instapayHandle", "")
        val email = merchant.optString("email", "")

        val intent = Intent(context, MainActivity::class.java).apply {
            action = ACTION_REVIEW_PENDING
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("TARGET_MERCHANT_ID", id)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = context.getString(R.string.notif_new_merchant_title)
        val body = context.getString(R.string.notif_new_merchant_body, businessName)

        val bigText = buildString {
            append("Business: ").append(businessName)
            if (handle.isNotEmpty()) append("\nInstaPay: ").append(handle)
            if (email.isNotEmpty()) append("\nEmail: ").append(email)
            append("\nStatus: Awaiting Admin Approval")
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_bell)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigText).setSummaryText("Merchant Review Required"))
            .setColor(context.getColor(R.color.brand_primary))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(pendingIntent)
            .addAction(
                R.drawable.ic_check_circle,
                context.getString(R.string.notif_action_review),
                pendingIntent
            )

        try {
            val notificationManager = NotificationManagerCompat.from(context)
            notificationManager.notify(id.hashCode(), builder.build())
        } catch (e: SecurityException) {
            // Permission not granted or restricted
        }
    }

    fun dismissMerchantNotification(context: Context, merchantId: String) {
        try {
            val notificationManager = NotificationManagerCompat.from(context)
            notificationManager.cancel(merchantId.hashCode())
        } catch (e: Exception) {}
    }
}
