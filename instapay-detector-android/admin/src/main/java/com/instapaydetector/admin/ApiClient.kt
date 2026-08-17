package com.instapaydetector.admin

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private const val PREFS_NAME = "admin_prefs"
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    fun getGatewayUrl(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("gateway_url", "") ?: ""
    }

    fun getPortalHash(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("portal_hash", "") ?: ""
    }

    fun getOwnerSecret(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("owner_secret", "") ?: ""
    }

    fun clearPrefs(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
    }

    suspend fun get(context: Context, path: String): ApiResponse = withContext(Dispatchers.IO) {
        val baseUrl = getGatewayUrl(context)
        val secret = getOwnerSecret(context)
        if (baseUrl.isEmpty() || secret.isEmpty()) {
            return@withContext ApiResponse(false, null, "Not configured")
        }

        val request = Request.Builder()
            .url("$baseUrl$path")
            .addHeader("Authorization", "Bearer $secret")
            .get()
            .build()

        executeRequest(request)
    }

    suspend fun post(context: Context, path: String, jsonBody: JSONObject): ApiResponse = withContext(Dispatchers.IO) {
        val baseUrl = getGatewayUrl(context)
        val secret = getOwnerSecret(context)
        if (baseUrl.isEmpty() || secret.isEmpty()) {
            return@withContext ApiResponse(false, null, "Not configured")
        }

        val body = jsonBody.toString().toRequestBody(JSON_MEDIA_TYPE)
        val request = Request.Builder()
            .url("$baseUrl$path")
            .addHeader("Authorization", "Bearer $secret")
            .post(body)
            .build()

        executeRequest(request)
    }

    suspend fun patch(context: Context, path: String, jsonBody: JSONObject): ApiResponse = withContext(Dispatchers.IO) {
        val baseUrl = getGatewayUrl(context)
        val secret = getOwnerSecret(context)
        if (baseUrl.isEmpty() || secret.isEmpty()) {
            return@withContext ApiResponse(false, null, "Not configured")
        }

        val body = jsonBody.toString().toRequestBody(JSON_MEDIA_TYPE)
        val request = Request.Builder()
            .url("$baseUrl$path")
            .addHeader("Authorization", "Bearer $secret")
            .patch(body)
            .build()

        executeRequest(request)
    }

    suspend fun delete(context: Context, path: String): ApiResponse = withContext(Dispatchers.IO) {
        val baseUrl = getGatewayUrl(context)
        val secret = getOwnerSecret(context)
        if (baseUrl.isEmpty() || secret.isEmpty()) {
            return@withContext ApiResponse(false, null, "Not configured")
        }

        val request = Request.Builder()
            .url("$baseUrl$path")
            .addHeader("Authorization", "Bearer $secret")
            .delete()
            .build()

        executeRequest(request)
    }

    private fun executeRequest(request: Request): ApiResponse {
        return try {
            client.newCall(request).execute().use { response ->
                val bodyStr = response.body?.string() ?: ""
                if (response.code == 401) {
                    ApiResponse(false, null, "Unauthorized", true)
                } else if (response.isSuccessful) {
                    try {
                        ApiResponse(true, JSONObject(bodyStr), null)
                    } catch (e: Exception) {
                        ApiResponse(true, null, "Invalid JSON: ${e.message}")
                    }
                } else {
                    val errMsg = try {
                        JSONObject(bodyStr).optString("error", "HTTP ${response.code}")
                    } catch (e: Exception) {
                        "HTTP ${response.code}"
                    }
                    ApiResponse(false, null, errMsg)
                }
            }
        } catch (e: IOException) {
            ApiResponse(false, null, "Network error: ${e.message}")
        }
    }

    data class ApiResponse(
        val isSuccessful: Boolean,
        val json: JSONObject?,
        val errorMessage: String?,
        val isUnauthorized: Boolean = false
    )
}
