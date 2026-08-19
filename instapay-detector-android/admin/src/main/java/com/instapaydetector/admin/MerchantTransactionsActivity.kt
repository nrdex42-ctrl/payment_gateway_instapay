package com.instapaydetector.admin

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.instapaydetector.admin.databinding.ActivityMerchantTransactionsBinding

class MerchantTransactionsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMerchantTransactionsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMerchantTransactionsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val clientId = intent.getStringExtra("CLIENT_ID") ?: ""
        val businessName = intent.getStringExtra("BUSINESS_NAME") ?: "Merchant"

        binding.toolbar.title = "Transactions: $businessName"
        binding.toolbar.setNavigationOnClickListener { finish() }

        if (savedInstanceState == null) {
            val fragment = TransactionsFragment().apply {
                arguments = Bundle().apply {
                    putString("clientId", clientId)
                }
            }
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, fragment)
                .commit()
        }
    }
}
