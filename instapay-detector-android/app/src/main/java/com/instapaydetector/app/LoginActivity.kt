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

        binding.btnLogin.setOnClickListener {
            handleLogin(config)
        }
    }

    private fun handleLogin(config: GatewayConfig) {
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString()?.trim() ?: ""
        val otp = binding.etOtp.text?.toString()?.trim() ?: ""

        if (email.isEmpty() || password.isEmpty()) {
            showError("All fields are required.")
            return
        }

        binding.btnLogin.isEnabled = false
        binding.btnLogin.text = "Logging in..."
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                performLoginRequest(email, password, config.pendingVerificationId, otp)
            }

            result.fold(
                onSuccess = { responseJson ->
                    val apiKey = responseJson.optString("apiKey", "")
                    val detectToken = responseJson.optString("detectToken", "")
                    val instapayHandle = responseJson.optString("instapayHandle", "")
                    val responseEmail = responseJson.optString("email", "")
                    val plan = responseJson.optString("subscriptionPlan", "FREE_TRIAL")
                    val subscriptionEndsAt = responseJson.optString("subscriptionEndsAt", "")

                    if (responseJson.optBoolean("otpRequired", false)) {
                        config.pendingVerificationId = responseJson.optString("verificationId")
                        binding.etOtp.visibility = View.VISIBLE
                        binding.btnLogin.text = "Verify and log in"
                        showError("Verification code sent to your email.")
                        binding.btnLogin.isEnabled = true
                    } else if (apiKey.isNotEmpty() && detectToken.isNotEmpty() && instapayHandle.isNotEmpty()) {
                        config.gatewayUrl = "https://instapay-ruddy.vercel.app/api/webhooks/instapay"
                        config.dashboardApiKey = apiKey
                        config.authToken = detectToken
                        config.merchantHandle = instapayHandle
                        config.merchantEmail = responseEmail
                        config.subscriptionPlan = plan
                        config.subscriptionEndsAt = subscriptionEndsAt.ifBlank { null }
                        config.pendingVerificationId = ""
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

    private fun performLoginRequest(email: String, password: String, verificationId: String, otp: String): Result<JSONObject> {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val jsonBody = JSONObject().apply {
            put("email", email)
            put("password", password)
            if (verificationId.isNotBlank()) put("verificationId", verificationId)
            if (otp.isNotBlank()) put("otp", otp)
        }
        val requestBody = jsonBody.toString().toRequestBody(mediaType)
        val request = Request.Builder()
            .url("https://instapay-ruddy.vercel.app/api/auth/apk-login")
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
