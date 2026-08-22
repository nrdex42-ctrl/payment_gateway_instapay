package com.instapaydetector.app

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Stores the gateway webhook URL + bearer token (detectToken) + client handle in encrypted
 * SharedPreferences so they aren't readable by other apps.
 *
 * The values must match what the gateway expects:
 *   - URL: https://your-gateway.example.com/api/webhooks/instapay
 *   - Token: the detectToken generated for this client in the Admin console
 *   - Handle: the client's own InstaPay handle (e.g. businessname@instapay)
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

    var dashboardApiKey: String
        get() = prefs.getString(KEY_DASHBOARD_API_KEY, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_DASHBOARD_API_KEY, value.trim()).apply()
        }

    var merchantHandle: String
        get() = prefs.getString(KEY_MERCHANT_HANDLE, DEFAULT_MERCHANT_HANDLE) ?: DEFAULT_MERCHANT_HANDLE
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_HANDLE, value.trim().lowercase()).apply()
        }

    var merchantEmail: String
        get() = prefs.getString(KEY_MERCHANT_EMAIL, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_EMAIL, value.trim().lowercase()).apply()
        }

    var subscriptionPlan: String
        get() = prefs.getString(KEY_SUBSCRIPTION_PLAN, "FREE_TRIAL") ?: "FREE_TRIAL"
        set(value) {
            prefs.edit().putString(KEY_SUBSCRIPTION_PLAN, value.trim()).apply()
        }

    var subscriptionEndsAt: String?
        get() = prefs.getString(KEY_SUBSCRIPTION_ENDS_AT, null)
        set(value) {
            prefs.edit().putString(KEY_SUBSCRIPTION_ENDS_AT, value?.trim()).apply()
        }

    var isLoggedIn: Boolean
        get() = prefs.getBoolean(KEY_IS_LOGGED_IN, false)
        set(value) {
            prefs.edit().putBoolean(KEY_IS_LOGGED_IN, value).apply()
        }

    var pendingVerificationId: String
        get() = prefs.getString(KEY_PENDING_VERIFICATION, "") ?: ""
        set(value) { prefs.edit().putString(KEY_PENDING_VERIFICATION, value).apply() }

    companion object {
        private const val FILE_NAME = "gateway_config.xml"
        private const val KEY_URL = "gateway_url"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_DASHBOARD_API_KEY = "dashboard_api_key"
        private const val KEY_MERCHANT_HANDLE = "merchant_handle"
        private const val KEY_MERCHANT_EMAIL = "merchant_email"
        private const val KEY_SUBSCRIPTION_PLAN = "subscription_plan"
        private const val KEY_SUBSCRIPTION_ENDS_AT = "subscription_ends_at"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"
        private const val KEY_PENDING_VERIFICATION = "pending_verification"

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
