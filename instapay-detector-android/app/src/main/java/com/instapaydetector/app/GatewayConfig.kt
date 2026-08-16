package com.instapaydetector.app

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Stores the gateway webhook URL + bearer token + detector mode in encrypted
 * SharedPreferences so they aren't readable by other apps or in backups.
 *
 * The values must match what the gateway expects:
 *   - URL: https://your-gateway.example.com/api/webhooks/instapay
 *   - Token: the DETECT_TOKEN env var set on the gateway
 *   - Mode: MERCHANT (default) or CLIENT
 *   - My handle: only used in CLIENT mode, the client's own InstaPay handle
 */
class GatewayConfig private constructor(ctx: Context) {

    private val prefs by lazy {
        val masterKey = MasterKey.Builder(ctx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            ctx,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var gatewayUrl: String
        get() = prefs.getString(KEY_URL, DEFAULT_URL) ?: DEFAULT_URL
        set(value) {
            val normalized = value.trim().trimEnd('/')
            prefs.edit().putString(KEY_URL, normalized).apply()
        }

    var authToken: String
        get() = prefs.getString(KEY_TOKEN, DEFAULT_TOKEN) ?: DEFAULT_TOKEN
        set(value) {
            prefs.edit().putString(KEY_TOKEN, value.trim()).apply()
        }

    /** MERCHANT = listen for "received" notifications (default).
     *  CLIENT = listen for "sent" notifications (belt-and-suspenders). */
    var detectorMode: DetectorMode
        get() {
            val raw = prefs.getString(KEY_MODE, DetectorMode.MERCHANT.name) ?: DetectorMode.MERCHANT.name
            return runCatching { DetectorMode.valueOf(raw) }.getOrDefault(DetectorMode.MERCHANT)
        }
        set(value) {
            prefs.edit().putString(KEY_MODE, value.name).apply()
        }

    /** The merchant handle this gateway is associated with. Used in MERCHANT
     *  mode for the status notification, and as a sanity check in CLIENT mode. */
    var merchantHandle: String
        get() = prefs.getString(KEY_MERCHANT_HANDLE, DEFAULT_MERCHANT_HANDLE) ?: DEFAULT_MERCHANT_HANDLE
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_HANDLE, value.trim().lowercase()).apply()
        }

    /** In CLIENT mode, this is the client's own InstaPay handle. Required for
     *  the webhook to know who sent the payment. */
    var myHandle: String
        get() = prefs.getString(KEY_MY_HANDLE, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_MY_HANDLE, value.trim().lowercase()).apply()
        }

    companion object {
        private const val FILE_NAME = "gateway_config.xml"
        private const val KEY_URL = "gateway_url"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_MODE = "detector_mode"
        private const val KEY_MERCHANT_HANDLE = "merchant_handle"
        private const val KEY_MY_HANDLE = "my_handle"

        private const val DEFAULT_URL =
            "https://your-gateway.example.com/api/webhooks/instapay"
        private const val DEFAULT_TOKEN = "instapay-sandbox-detector-token-2026"
        private const val DEFAULT_MERCHANT_HANDLE = "mohammedshabana77@instapay"

        @Volatile
        private var instance: GatewayConfig? = null

        fun get(ctx: Context): GatewayConfig =
            instance ?: synchronized(this) {
                instance ?: GatewayConfig(ctx.applicationContext).also { instance = it }
            }
    }
}

enum class DetectorMode {
    /** Runs on the merchant's phone. Forwards "You have received X EGP from <handle>" notifications. */
    MERCHANT,

    /** Runs on the client's phone. Forwards "You have sent X EGP to <handle>" notifications. */
    CLIENT
}
