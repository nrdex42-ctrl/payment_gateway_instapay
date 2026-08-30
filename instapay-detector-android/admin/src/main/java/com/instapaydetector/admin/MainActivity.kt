package com.instapaydetector.admin

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.google.android.material.tabs.TabLayoutMediator
import com.instapaydetector.admin.databinding.ActivityMainBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val merchantsFragment = MerchantsFragment()

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Permission result handled; notifications will work if granted
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Load configs
        val prefs = ApiClient.getPrefs(this)
        val portalHash = prefs.getString("portal_hash", "") ?: ""
        val ownerSecret = prefs.getString("owner_secret", "") ?: ""

        if (portalHash.isEmpty() || ownerSecret.isEmpty()) {
            startSetupActivity()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize system notification channel
        AdminNotificationHelper.initNotificationChannel(this)
        checkNotificationPermission()

        setupViewPager()
        setupNotificationIcon()
        startPeriodicPendingCheck()

        handleNotificationIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNotificationIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        fetchPendingApprovals()
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun handleNotificationIntent(intent: Intent?) {
        if (intent?.action == AdminNotificationHelper.ACTION_REVIEW_PENDING || intent?.hasExtra("TARGET_MERCHANT_ID") == true) {
            showPendingApprovalsBottomSheet()
        }
    }

    private fun setupViewPager() {
        val tabs = listOf(
            AdminTab("Ops", OpsFragment(), R.drawable.ic_gauge),
            AdminTab("Merchants", merchantsFragment, R.drawable.ic_nav_merchants),
            AdminTab("Billing", BillingFragment(), R.drawable.ic_calendar),
            AdminTab("Notify", NotificationsFragment(), R.drawable.ic_bell),
            AdminTab("Transactions", TransactionsFragment(), R.drawable.ic_nav_transactions),
            AdminTab("Webhooks", WebhooksFragment(), R.drawable.ic_globe),
            AdminTab("Activity", ActivityFragment(), R.drawable.ic_activity),
            AdminTab("Settings", SettingsFragment(), R.drawable.ic_nav_settings),
            AdminTab("Audit", AuditFragment(), R.drawable.ic_shield)
        )

        binding.viewPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount(): Int = tabs.size
            override fun createFragment(position: Int): Fragment = tabs[position].fragment
        }

        // Keep tab changes deliberate; lists inside screens handle vertical gestures.
        binding.viewPager.isUserInputEnabled = false

        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = tabs[position].title
            tab.setIcon(tabs[position].iconRes)
        }.attach()
    }

    private fun setupNotificationIcon() {
        binding.btnNotifications.setOnClickListener {
            showPendingApprovalsBottomSheet()
        }
    }

    private fun showPendingApprovalsBottomSheet() {
        val sheet = PendingApprovalsBottomSheet(
            onActionCompleted = {
                fetchPendingApprovals()
            },
            onNavigateToMerchants = {
                navigateToMerchantsTab(filterPending = true)
            }
        )
        sheet.show(supportFragmentManager, "PendingApprovalsBottomSheet")
    }

    private fun navigateToMerchantsTab(filterPending: Boolean) {
        binding.viewPager.currentItem = 1
        if (filterPending) {
            merchantsFragment.setPendingFilter()
        }
    }

    private fun startPeriodicPendingCheck() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (isActive) {
                    fetchPendingApprovals()
                    delay(20_000) // Poll every 20 seconds for new merchant signups
                }
            }
        }
    }

    fun fetchPendingApprovals() {
        lifecycleScope.launch {
            val response = ApiClient.get(this@MainActivity, "/api/admin/clients")
            if (response.isSuccessful && response.json != null) {
                val array = response.json.optJSONArray("clients") ?: JSONArray()
                val pendingCount = AdminNotificationHelper.processPendingMerchants(this@MainActivity, array)
                updateBadges(pendingCount)
            } else if (response.isUnauthorized) {
                ApiClient.clearPrefs(this@MainActivity)
                startSetupActivity()
            }
        }
    }

    private fun updateBadges(pendingCount: Int) {
        // Header bell badge
        if (pendingCount > 0) {
            binding.tvNotificationBadge.visibility = View.VISIBLE
            binding.tvNotificationBadge.text = if (pendingCount > 99) "99+" else pendingCount.toString()
        } else {
            binding.tvNotificationBadge.visibility = View.GONE
        }

        // TabLayout Merchants tab badge (Tab index 1)
        val tab = binding.tabLayout.getTabAt(1)
        if (pendingCount > 0) {
            tab?.orCreateBadge?.apply {
                number = pendingCount
                isVisible = true
                backgroundColor = getColor(R.color.accent_amber)
                badgeTextColor = getColor(R.color.bg_root)
            }
        } else {
            tab?.removeBadge()
        }
    }

    private data class AdminTab(val title: String, val fragment: Fragment, val iconRes: Int)

    private fun startSetupActivity() {
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }
}
