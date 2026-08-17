package com.instapaydetector.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.instapaydetector.app.databinding.ActivityMainBinding
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

/**
 * Main host activity with bottom navigation for the client console:
 *   - Dashboard    → stats cards + revenue chart + recent payments preview
 *   - Transactions → full searchable list with filter + pull-to-refresh + CSV export
 *   - Settings     → gateway URL/token, merchant handle, notification permission
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    val apiClient by lazy { DashboardApiClient(this) }
    val paymentFeedback by lazy { PaymentFeedback(this) }
    val wsClient by lazy { DashboardWebSocketClient(this) }

    override fun attachBaseContext(newBase: android.content.Context) {
        super.attachBaseContext(LocaleHelper.onAttach(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Apply saved Language
        LocaleHelper.applyLocale(this)

        // Apply saved Theme before onCreate (check to prevent recreation loop)
        val prefs = getSharedPreferences("instapay_settings", MODE_PRIVATE)
        val savedTheme = prefs.getString("pref_theme", "system") ?: "system"
        val targetMode = when (savedTheme) {
            "light" -> androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_NO
            "dark" -> androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_YES
            else -> androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
        }
        if (androidx.appcompat.app.AppCompatDelegate.getDefaultNightMode() != targetMode) {
            androidx.appcompat.app.AppCompatDelegate.setDefaultNightMode(targetMode)
        }

        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val pagerAdapter = object : androidx.viewpager2.adapter.FragmentStateAdapter(this) {
            override fun getItemCount(): Int = 3
            override fun createFragment(position: Int): Fragment {
                return when (position) {
                    0 -> DashboardFragment()
                    1 -> TransactionsFragment()
                    else -> SettingsFragment()
                }
            }
        }
        binding.viewPager.adapter = pagerAdapter
        binding.viewPager.offscreenPageLimit = 2

        binding.bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_dashboard -> {
                    binding.viewPager.currentItem = 0
                    true
                }
                R.id.nav_transactions -> {
                    binding.viewPager.currentItem = 1
                    true
                }
                R.id.nav_settings -> {
                    binding.viewPager.currentItem = 2
                    true
                }
                else -> false
            }
        }

        binding.viewPager.registerOnPageChangeCallback(object : androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                binding.bottomNav.menu.getItem(position).isChecked = true
            }
        })

        // Restore tab position if saved instance exists
        val savedTab = savedInstanceState?.getInt("selected_tab", 0) ?: 0
        binding.viewPager.setCurrentItem(savedTab, false)
        binding.bottomNav.menu.getItem(savedTab).isChecked = true

        // Start the WebSocket client for real-time updates
        MainScope().launch { wsClient.start() }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::binding.isInitialized) {
            outState.putInt("selected_tab", binding.viewPager.currentItem)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        wsClient.stop()
    }
}
