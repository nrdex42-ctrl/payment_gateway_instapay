package com.instapaydetector.admin

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.instapaydetector.admin.databinding.FragmentMerchantsBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class MerchantsFragment : Fragment() {

    private var _binding: FragmentMerchantsBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: MerchantAdapter
    private val allMerchants = mutableListOf<JSONObject>()
    private val filteredMerchants = mutableListOf<JSONObject>()

    private var searchQuery = ""
    private var filterStatus = "ALL" // ALL, ACTIVE, PENDING, REJECTED

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentMerchantsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupListeners()

        binding.swipeRefresh.setOnRefreshListener {
            loadMerchants()
        }

        binding.fabCreate.setOnClickListener {
            val bottomSheet = CreateMerchantBottomSheet {
                binding.swipeRefresh.isRefreshing = true
                loadMerchants()
            }
            bottomSheet.show(childFragmentManager, "CreateMerchantBottomSheet")
        }

        binding.swipeRefresh.isRefreshing = true
        loadMerchants()
    }

    private fun setupRecyclerView() {
        adapter = MerchantAdapter(requireContext(), filteredMerchants,
            onToggleActive = { id, currentActive -> toggleMerchantStatus(id, currentActive) },
            onDelete = { id -> deleteMerchant(id) },
            onEditSubscription = { id -> showEditSubscriptionDialog(id) },
            onViewTransactions = { id, businessName ->
                val intent = android.content.Intent(requireContext(), MerchantTransactionsActivity::class.java).apply {
                    putExtra("CLIENT_ID", id)
                    putExtra("BUSINESS_NAME", businessName)
                }
                startActivity(intent)
            }
        )
        binding.rvMerchants.layoutManager = LinearLayoutManager(requireContext())
        binding.rvMerchants.adapter = adapter
    }

    private fun setupListeners() {
        // Search text watcher
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchQuery = s?.toString()?.lowercase() ?: ""
                applyFilters()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // Filter chips
        binding.chipGroupFilter.setOnCheckedStateChangeListener { _, checkedIds ->
            filterStatus = when (checkedIds.firstOrNull()) {
                R.id.chip_active -> "ACTIVE"
                R.id.chip_pending -> "PENDING"
                R.id.chip_rejected -> "REJECTED"
                else -> "ALL"
            }
            applyFilters()
        }
    }

    private fun loadMerchants() {
        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), "/api/admin/clients")
            binding.swipeRefresh.isRefreshing = false
            if (response.isSuccessful && response.json != null) {
                val array = response.json.optJSONArray("clients") ?: JSONArray()
                allMerchants.clear()
                for (i in 0 until array.length()) {
                    allMerchants.add(array.getJSONObject(i))
                }
                applyFilters()
            } else if (response.isUnauthorized) {
                handleUnauthorized()
            } else {
                Toast.makeText(requireContext(), response.errorMessage ?: "Failed to load merchants", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun applyFilters() {
        filteredMerchants.clear()
        for (item in allMerchants) {
            val name = item.optString("businessName").lowercase()
            val handle = item.optString("instapayHandle").lowercase()
            val email = item.optString("email").lowercase()
            val approvalStatus = item.optString("approvalStatus", "APPROVED").uppercase()
            val isActive = item.optBoolean("isActive", true)

            // Search Filter
            val matchesSearch = searchQuery.isEmpty() ||
                    name.contains(searchQuery) ||
                    handle.contains(searchQuery) ||
                    email.contains(searchQuery)

            // Status Filter
            val matchesStatus = when (filterStatus) {
                "ACTIVE" -> approvalStatus == "APPROVED" && isActive
                "PENDING" -> approvalStatus == "PENDING"
                "REJECTED" -> approvalStatus == "REJECTED"
                else -> true
            }

            if (matchesSearch && matchesStatus) {
                filteredMerchants.add(item)
            }
        }
        adapter.notifyDataSetChanged()
        binding.tvEmpty.visibility = if (filteredMerchants.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun toggleMerchantStatus(id: String, currentActive: Boolean) {
        lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            val body = JSONObject().apply {
                put("isActive", !currentActive)
            }
            val response = ApiClient.patch(requireContext(), "/api/admin/clients/$id", body)
            if (response.isSuccessful) {
                loadMerchants()
            } else {
                binding.swipeRefresh.isRefreshing = false
                Toast.makeText(requireContext(), response.errorMessage ?: "Failed to toggle status", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun deleteMerchant(id: String) {
        AlertDialog.Builder(requireContext())
            .setMessage(R.string.confirm_delete_merchant)
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_delete) { _, _ ->
                lifecycleScope.launch {
                    binding.swipeRefresh.isRefreshing = true
                    val response = ApiClient.delete(requireContext(), "/api/admin/clients/$id")
                    if (response.isSuccessful) {
                        loadMerchants()
                    } else {
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(requireContext(), response.errorMessage ?: "Failed to delete", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .show()
    }

    private fun showEditSubscriptionDialog(id: String) {
        val options = arrayOf("+1 Day Free Trial", "+30 Days Pro", "Expire Immediately")
        AlertDialog.Builder(requireContext())
            .setTitle("Manage Subscription")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> updateSubscription(id, "FREE_TRIAL", true, 1)
                    1 -> updateSubscription(id, "PRO", false, 30)
                    2 -> updateSubscription(id, "EXPIRED", false, -9999)
                }
            }
            .setNegativeButton(R.string.btn_cancel, null)
            .show()
    }

    private fun updateSubscription(id: String, plan: String, isTrial: Boolean, addDays: Int) {
        val client = allMerchants.find { it.optString("id") == id } ?: return
        
        var newDate: Long? = null
        if (addDays > 0) {
            val endsStr = client.optString("subscriptionEndsAt", "")
            var baseTime = System.currentTimeMillis()
            if (endsStr.isNotEmpty() && endsStr != "null") {
                try {
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                    val date = sdf.parse(endsStr)
                    if (date != null && date.time > baseTime) {
                        baseTime = date.time
                    }
                } catch (e: Exception) {}
            }
            newDate = baseTime + addDays * 24L * 60L * 60L * 1000L
        } else if (addDays < 0) {
            newDate = System.currentTimeMillis() - 24L * 60L * 60L * 1000L
        }

        lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            val body = JSONObject().apply {
                put("subscriptionPlan", plan)
                put("isFreeTrial", isTrial)
                if (newDate != null) {
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                    sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                    put("subscriptionEndsAt", sdf.format(java.util.Date(newDate)))
                } else {
                    put("subscriptionEndsAt", JSONObject.NULL)
                }
            }
            val response = ApiClient.patch(requireContext(), "/api/admin/clients/$id", body)
            if (response.isSuccessful) {
                loadMerchants()
            } else {
                binding.swipeRefresh.isRefreshing = false
                Toast.makeText(requireContext(), response.errorMessage ?: "Failed to update sub", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun handleUnauthorized() {
        ApiClient.clearPrefs(requireContext())
        startActivity(android.content.Intent(requireActivity(), SetupActivity::class.java))
        requireActivity().finish()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
