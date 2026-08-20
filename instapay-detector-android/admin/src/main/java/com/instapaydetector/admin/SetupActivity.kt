package com.instapaydetector.admin

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.admin.databinding.ActivitySetupBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject


class SetupActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupBinding
    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Redirect if already configured
        val prefs = ApiClient.getPrefs(this)
        val gatewayUrl = prefs.getString("gateway_url", null)
        val portalHash = prefs.getString("portal_hash", null)
        val ownerSecret = prefs.getString("owner_secret", null)

        if (!gatewayUrl.isNullOrEmpty() && !portalHash.isNullOrEmpty() && !ownerSecret.isNullOrEmpty()) {
            startMainActivity()
            return
        }

        binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Pre-fill default production server URL
        binding.etGatewayUrl.setText("https://instapay-ruddy.vercel.app")

        binding.btnConnect.setOnClickListener {
            handleSetup()
        }
    }

    private fun handleSetup() {
        val gatewayUrl = binding.etGatewayUrl.text?.toString()?.trim() ?: ""
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString()?.trim() ?: ""
        val totp = binding.etTotp.text?.toString()?.trim() ?: ""

        if (gatewayUrl.isEmpty() || email.isEmpty() || password.isEmpty() || totp.isEmpty()) {
            showError(getString(R.string.error_invalid_fields))
            return
        }

        if (!gatewayUrl.startsWith("http://") && !gatewayUrl.startsWith("https://")) {
            showError("URL must start with http:// or https://")
            return
        }

        // Clean trailing slashes
        val cleanUrl = gatewayUrl.removeSuffix("/")

        binding.btnConnect.isEnabled = false
        binding.btnConnect.text = getString(R.string.btn_verifying)
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            val token = withContext(Dispatchers.IO) {
                performAdminLogin(cleanUrl, email, password, totp)
            }
            if (token != null) {
                val prefs = ApiClient.getPrefs(this@SetupActivity)
                prefs.edit()
                    .putString("gateway_url", cleanUrl)
                    .putString("portal_hash", "admin")
                    .putString("owner_secret", token)
                    .apply()

                Toast.makeText(this@SetupActivity, "Setup Completed Successfully!", Toast.LENGTH_SHORT).show()
                startMainActivity()
            } else {
                binding.btnConnect.isEnabled = true
                binding.btnConnect.text = getString(R.string.btn_connect)
                showError("Connection or authentication failed. Check credentials/2FA.")
            }
        }
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    private fun performAdminLogin(url: String, email: String, password: String, totp: String): String? {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val jsonBody = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("totp", totp)
        }
        val requestBody = jsonBody.toString().toRequestBody(mediaType)
        val request = Request.Builder()
            .url("$url/api/admin/auth")
            .post(requestBody)
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                val bodyStr = response.body?.string() ?: ""
                if (response.code == 200) {
                    val json = JSONObject(bodyStr)
                    if (json.has("token")) json.getString("token") else null
                } else {
                    null
                }
            }
        } catch (e: IOException) {
            e.printStackTrace()
            null
        }
    }

    private fun startMainActivity() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
