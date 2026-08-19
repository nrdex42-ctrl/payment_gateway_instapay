package com.instapaydetector.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.app.databinding.ActivityLoginBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val config = GatewayConfig.get(this)

        // Prefill Server URL
        val currentUrl = config.gatewayUrl
        val defaultMockUrl = "https://your-gateway.example.com/api/webhooks/instapay"
        if (currentUrl == defaultMockUrl) {
            binding.etServerUrl.setText("https://your-gateway.example.com")
        } else {
            val base = if (currentUrl.contains("/api/webhooks/instapay")) {
                currentUrl.substring(0, currentUrl.indexOf("/api/webhooks/instapay"))
            } else {
                currentUrl.trimEnd('/').substringBeforeLast('/')
            }
            binding.etServerUrl.setText(base)
        }

        // Also prefill handle if any
        if (config.merchantHandle != "mohammedshabana77@instapay") {
            binding.etInstapayHandle.setText(config.merchantHandle)
        }

        binding.btnLogin.setOnClickListener {
            handleLogin(config)
        }
    }

    private fun handleLogin(config: GatewayConfig) {
        val serverUrl = binding.etServerUrl.text?.toString()?.trim() ?: ""
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString()?.trim() ?: ""
        val handle = binding.etInstapayHandle.text?.toString()?.trim() ?: ""

        if (serverUrl.isEmpty() || email.isEmpty() || password.isEmpty() || handle.isEmpty()) {
            showError("All fields are required.")
            return
        }

        if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
            showError("Server URL must start with http:// or https://")
            return
        }

        val cleanUrl = serverUrl.removeSuffix("/")
        binding.btnLogin.isEnabled = false
        binding.btnLogin.text = "Logging in..."
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                performLoginRequest(cleanUrl, email, password, handle)
            }

            result.fold(
                onSuccess = { responseJson ->
                    val detectToken = responseJson.optString("detectToken", "")
                    val instapayHandle = responseJson.optString("instapayHandle", "")

                    if (detectToken.isNotEmpty() && instapayHandle.isNotEmpty()) {
                        config.gatewayUrl = "$cleanUrl/api/webhooks/instapay"
                        config.authToken = detectToken
                        config.merchantHandle = instapayHandle
                        config.isLoggedIn = true

                        Toast.makeText(this@LoginActivity, "Login Successful!", Toast.LENGTH_SHORT).show()
                        
                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else {
                        binding.btnLogin.isEnabled = true
                        binding.btnLogin.text = "Log In"
                        showError("Invalid response from server.")
                    }
                },
                onFailure = { exception ->
                    binding.btnLogin.isEnabled = true
                    binding.btnLogin.text = "Log In"
                    showError(exception.message ?: "Connection failed.")
                }
            )
        }
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    private fun performLoginRequest(serverUrl: String, email: String, password: String, handle: String): Result<JSONObject> {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val jsonBody = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("instapayHandle", handle)
        }
        val requestBody = jsonBody.toString().toRequestBody(mediaType)
        val request = Request.Builder()
            .url("$serverUrl/api/auth/apk-login")
            .post(requestBody)
            .build()

        return try {
            httpClient.newCall(request).execute().use { response ->
                val bodyStr = response.body?.string().orEmpty()
                if (response.code == 200) {
                    Result.success(JSONObject(bodyStr))
                } else {
                    val errMsg = try {
                        JSONObject(bodyStr).optString("error", "HTTP ${response.code}")
                    } catch (e: Exception) {
                        "HTTP ${response.code}"
                    }
                    Result.failure(Exception(errMsg))
                }
            }
        } catch (e: IOException) {
            e.printStackTrace()
            Result.failure(e)
        }
    }
}
