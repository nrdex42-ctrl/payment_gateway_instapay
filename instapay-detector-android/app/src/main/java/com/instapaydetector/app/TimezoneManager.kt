package com.instapaydetector.app

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Timezone and Egypt Summer Time (DST) Manager for the Android App.
 * Allows the owner to select between:
 *   - AUTO   : Africa/Cairo timezone (auto-calculates DST offset +2 / +3)
 *   - SUMMER : Forced Egypt Summer Time (UTC+3 / EEST)
 *   - WINTER : Forced Egypt Winter Time (UTC+2 / EET)
 */
object TimezoneManager {

    enum class DstMode(val key: String, val label: String) {
        AUTO("AUTO", "Auto (Africa/Cairo)"),
        SUMMER("SUMMER", "☀️ Summer Time (UTC+3)"),
        WINTER("WINTER", "❄️ Winter Time (UTC+2)");

        companion object {
            fun fromKey(key: String?): DstMode {
                return values().find { it.key.equals(key, ignoreCase = true) } ?: AUTO
            }
        }
    }

    private const val PREFS_NAME = "instapay_timezone_prefs"
    private const val KEY_DST_MODE = "egypt_dst_mode"

    fun getDstMode(context: Context): DstMode {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val key = prefs.getString(KEY_DST_MODE, DstMode.AUTO.key)
        return DstMode.fromKey(key)
    }

    fun setDstMode(context: Context, mode: DstMode) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_DST_MODE, mode.key).apply()
    }

    fun getTimeZone(context: Context): TimeZone {
        return when (getDstMode(context)) {
            DstMode.SUMMER -> TimeZone.getTimeZone("GMT+03:00")
            DstMode.WINTER -> TimeZone.getTimeZone("GMT+02:00")
            DstMode.AUTO -> TimeZone.getTimeZone("Africa/Cairo")
        }
    }

    fun formatEgyptTime(context: Context, timestampMs: Long): String {
        if (timestampMs <= 0) return ""
        val tz = getTimeZone(context)
        val sdf = SimpleDateFormat("yyyy-MM-dd hh:mm:ss a", Locale.ENGLISH)
        sdf.timeZone = tz
        val label = when (getDstMode(context)) {
            DstMode.SUMMER -> "EEST (UTC+3)"
            DstMode.WINTER -> "EET (UTC+2)"
            DstMode.AUTO -> {
                val cal = Calendar.getInstance(tz)
                cal.timeInMillis = timestampMs
                if (tz.inDaylightTime(Date(timestampMs))) "EEST (UTC+3)" else "EET (UTC+2)"
            }
        }
        return "${sdf.format(Date(timestampMs))} ($label)"
    }
}
