package com.instapaydetector.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.instapaydetector.app.databinding.ActivityMainBinding
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

/**
 * Main host activity with bottom navigation:
 *
 * For OWNER flavor:
 *   - Dashboard    → stats cards + revenue chart + recent payments preview
 *   - Transactions → full searchable list with filter + pull-to-refresh + CSV export
 *   - Settings     → gateway URL/token, merchant handle, notification permission
 *
 * For CLIENT flavor:
 *   - New Checkout → payment link & deep link generator with live waiting screen
 *   - Developer API→ integration keys, HMAC signer tool, and code snippets
 *   - My Payments  → client checkouts log
 *   - Settings     → webhook endpoint & client notification listener configuration
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    val apiClient by lazy { DashboardApiClient(this) }
    val paymentFeedback by lazy { PaymentFeedback(this) }
    val wsClient by lazy { DashboardWebSocketClient(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val isClientFlavor = BuildConfig.APP_ROLE == "CLIENT"

        if (isClientFlavor) {
            binding.bottomNav.menu.clear()
            binding.bottomNav.inflateMenu(R.menu.bottom_nav_client)

            binding.bottomNav.setOnItemSelectedListener { item ->
                when (item.itemId) {
                    R.id.nav_checkout -> {
                        swapFragment(ClientCheckoutFragment())
                        true
                    }
                    R.id.nav_integration -> {
                        swapFragment(ClientIntegrationHubFragment())
                        true
                    }
                    R.id.nav_transactions -> {
                        swapFragment(TransactionsFragment())
                        true
                    }
                    R.id.nav_settings -> {
                        swapFragment(SettingsFragment())
                        true
                    }
                    else -> false
                }
            }

            if (savedInstanceState == null) {
                binding.bottomNav.selectedItemId = R.id.nav_checkout
            }
        } else {
            binding.bottomNav.setOnItemSelectedListener { item ->
                when (item.itemId) {
                    R.id.nav_dashboard -> {
                        swapFragment(DashboardFragment())
                        true
                    }
                    R.id.nav_transactions -> {
                        swapFragment(TransactionsFragment())
                        true
                    }
                    R.id.nav_settings -> {
                        swapFragment(SettingsFragment())
                        true
                    }
                    else -> false
                }
            }

            if (savedInstanceState == null) {
                binding.bottomNav.selectedItemId = R.id.nav_dashboard
            }
        }

        // Start the WebSocket client for real-time updates
        MainScope().launch { wsClient.start() }
    }

    override fun onDestroy() {
        super.onDestroy()
        wsClient.stop()
    }

    private fun swapFragment(fragment: Fragment) {
        supportFragmentManager
            .beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }
}
