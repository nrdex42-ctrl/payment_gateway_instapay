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

class SetupActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupBinding
    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Redirect if already configured
        val prefs = getSharedPreferences("admin_prefs", Context.MODE_PRIVATE)
        val gatewayUrl = prefs.getString("gateway_url", null)
        val portalHash = prefs.getString("portal_hash", null)
        val ownerSecret = prefs.getString("owner_secret", null)

        if (!gatewayUrl.isNullOrEmpty() && !portalHash.isNullOrEmpty() && !ownerSecret.isNullOrEmpty()) {
            startMainActivity()
            return
        }

        binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnConnect.setOnClickListener {
            handleSetup()
        }
    }

    private fun handleSetup() {
        val gatewayUrl = binding.etGatewayUrl.text?.toString()?.trim() ?: ""
        val portalHash = binding.etPortalHash.text?.toString()?.trim() ?: ""
        val ownerSecret = binding.etOwnerSecret.text?.toString()?.trim() ?: ""

        if (gatewayUrl.isEmpty() || portalHash.isEmpty() || ownerSecret.isEmpty()) {
            showError(getString(R.string.error_invalid_fields))
            return
        }

        if (!gatewayUrl.startsWith("http://") && !gatewayUrl.startsWith("https://")) {
            showError("URL must start with http:// or https://")
            return
        }

        // Clean trailing slashes
        val cleanUrl = gatewayUrl.removeSuffix("/")
        val cleanHash = portalHash.removePrefix("/").removeSuffix("/")

        binding.btnConnect.isEnabled = false
        binding.btnConnect.text = getString(R.string.btn_verifying)
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            val isValid = withContext(Dispatchers.IO) {
                verifyCredentials(cleanUrl, ownerSecret)
            }
            if (isValid) {
                val prefs = getSharedPreferences("admin_prefs", Context.MODE_PRIVATE)
                prefs.edit()
                    .putString("gateway_url", cleanUrl)
                    .putString("portal_hash", cleanHash)
                    .putString("owner_secret", ownerSecret)
                    .apply()

                Toast.makeText(this@SetupActivity, "Setup Completed Successfully!", Toast.LENGTH_SHORT).show()
                startMainActivity()
            } else {
                binding.btnConnect.isEnabled = true
                binding.btnConnect.text = getString(R.string.btn_connect)
                showError(getString(R.string.error_connection_failed))
            }
        }
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    private fun verifyCredentials(url: String, secret: String): Boolean {
        val request = Request.Builder()
            .url("$url/api/admin/audit")
            .addHeader("Authorization", "Bearer $secret")
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                response.code == 200
            }
        } catch (e: IOException) {
            e.printStackTrace()
            false
        }
    }

    private fun startMainActivity() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
