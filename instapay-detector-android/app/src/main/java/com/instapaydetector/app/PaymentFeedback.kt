package com.instapaydetector.app

import android.content.Context
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

/**
 * Plays a "ka-ching" payment sound + vibrates the device when a new
 * payment is confirmed. This gives the merchant instant tactile + audio
 * feedback even if the app is in the background (as long as the
 * NotificationListenerService is running).
 *
 * The sound uses the system notification sound (respecting the user's
 * ringer mode). The vibration is a short-long "ka-ching" pattern.
 */
class PaymentFeedback(ctx: Context) {

    private val context = ctx.applicationContext
    private val vibrator: Vibrator? by lazy { resolveVibrator() }

    /** Play the payment sound + vibrate. Safe to call from any thread. */
    fun celebrate() {
        try {
            playSound()
            vibrate()
        } catch (e: Exception) {
            Log.w(TAG, "celebrate failed: ${e.message}")
        }
    }

    private fun playSound() {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        // Respect the user's ringer mode — don't play sound if silenced
        if (audioManager.ringerMode != AudioManager.RINGER_MODE_NORMAL) return

        try {
            // Play the system notification sound
            val soundUri = android.provider.Settings.System.DEFAULT_NOTIFICATION_URI
            val mediaPlayer = MediaPlayer().apply {
                setDataSource(context, soundUri)
                setAudioStreamType(AudioManager.STREAM_NOTIFICATION)
                setOnPreparedListener { start() }
                setOnCompletionListener { release() }
                setOnErrorListener { _, _, _ -> release(); true }
            }
            mediaPlayer.prepareAsync()
        } catch (e: Exception) {
            Log.w(TAG, "Could not play sound: ${e.message}")
        }
    }

    private fun vibrate() {
        val v = vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Pattern: short-short-long (like a cash register "ka-ching")
            val timings = longArrayOf(0, 60, 40, 120)
            val amplitudes = intArrayOf(0, 200, 0, 255)
            v.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(longArrayOf(0, 60, 40, 120), -1)
        }
    }

    private fun resolveVibrator(): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    companion object {
        private const val TAG = "PaymentFeedback"
    }
}
