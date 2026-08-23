package com.instapaydetector.admin

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import androidx.viewpager2.widget.ViewPager2
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
        val fragments = listOf(
            DashboardFragment(),
            MerchantsFragment(),
            TransactionsFragment(),
            OpsFragment(),
            SettingsFragment()
        )

        binding.viewPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount(): Int = fragments.size
            override fun createFragment(position: Int): Fragment = fragments[position]
        }

        // Disable user swiping to prevent accidental navigation inside lists
        binding.viewPager.isUserInputEnabled = false

        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                binding.bottomNav.menu.getItem(position).isChecked = true
            }
        })

        binding.bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_dashboard -> {
                    binding.viewPager.currentItem = 0
                    true
                }
                R.id.nav_merchants -> {
                    binding.viewPager.currentItem = 1
                    true
                }
                R.id.nav_transactions -> {
                    binding.viewPager.currentItem = 2
                    true
                }
                R.id.nav_ops -> {
                    binding.viewPager.currentItem = 3
                    true
                }
                R.id.nav_settings -> {
                    binding.viewPager.currentItem = 4
                    true
                }
                else -> false
            }
        }
    }

    private fun startSetupActivity() {
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }
}
