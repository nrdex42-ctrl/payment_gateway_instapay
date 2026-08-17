package com.instapaydetector.admin

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.instapaydetector.admin.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var gatewayUrl: String = ""
    private var portalHash: String = ""
    private var ownerSecret: String = ""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Load configs
        val prefs = getSharedPreferences("admin_prefs", Context.MODE_PRIVATE)
        gatewayUrl = prefs.getString("gateway_url", "") ?: ""
        portalHash = prefs.getString("portal_hash", "") ?: ""
        ownerSecret = prefs.getString("owner_secret", "") ?: ""

        if (gatewayUrl.isEmpty() || portalHash.isEmpty()) {
            startSetupActivity()
            return
        }

        // Configure WebView
        val webSettings = binding.webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.loadWithOverviewMode = true
        webSettings.useWideViewPort = true
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.swipeRefresh.isRefreshing = false

                // Inject auth token if on the portal path
                if (url != null && url.contains("/portal/")) {
                    view?.evaluateJavascript(
                        "localStorage.setItem('owner_secret_token', '$ownerSecret');",
                        null
                    )
                }

                // If user lands on general login or root, notify how to reset
                if (url != null && (url.endsWith("/login") || url.endsWith("/register") || url == "$gatewayUrl/")) {
                    Toast.makeText(this@MainActivity, "Logged out. To change server URL, clear App storage or re-open the app.", Toast.LENGTH_LONG).show()
                }
            }
        }

        // Swipe to Refresh
        binding.swipeRefresh.setOnRefreshListener {
            binding.webView.reload()
        }

        // Load initial page
        val fullUrl = "$gatewayUrl/portal/$portalHash"
        binding.webView.loadUrl(fullUrl)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && binding.webView.canGoBack()) {
            binding.webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun startSetupActivity() {
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }
}
