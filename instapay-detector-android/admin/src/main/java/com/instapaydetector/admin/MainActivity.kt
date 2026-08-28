package com.instapaydetector.admin

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.google.android.material.tabs.TabLayoutMediator
import com.instapaydetector.admin.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Load configs
        val prefs = ApiClient.getPrefs(this)
        val gatewayUrl = prefs.getString("gateway_url", "") ?: ""
        val portalHash = prefs.getString("portal_hash", "") ?: ""

        if (gatewayUrl.isEmpty() || portalHash.isEmpty()) {
            startSetupActivity()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupViewPager()
    }

    private fun setupViewPager() {
        val tabs = listOf(
            AdminTab("Ops Center", OpsFragment()),
            AdminTab("Merchants", MerchantsFragment()),
            AdminTab("Billing", BillingFragment()),
            AdminTab("Notifications", NotificationsFragment()),
            AdminTab("Transactions", TransactionsFragment()),
            AdminTab("Webhooks", WebhooksFragment()),
            AdminTab("Activity", ActivityFragment()),
            AdminTab("Settings", SettingsFragment()),
            AdminTab("Audit", AuditFragment())
        )

        binding.viewPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount(): Int = tabs.size
            override fun createFragment(position: Int): Fragment = tabs[position].fragment
        }

        // Keep tab changes deliberate; lists inside screens handle vertical gestures.
        binding.viewPager.isUserInputEnabled = false

        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = tabs[position].title
        }.attach()
    }

    private data class AdminTab(val title: String, val fragment: Fragment)

    private fun startSetupActivity() {
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }
}
