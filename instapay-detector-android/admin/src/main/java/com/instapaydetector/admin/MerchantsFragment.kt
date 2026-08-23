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

        binding.btnCreateTop.setOnClickListener {
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
        val client = allMerchants.find { it.optString("id") == id } ?: return
        val currentPlan = client.optString("subscriptionPlan", "FREE_TRIAL")
        val currentIsTrial = client.optBoolean("isFreeTrial", true)
        val currentEndsAt = client.optString("subscriptionEndsAt", "")

        val context = requireContext()
        val container = android.widget.LinearLayout(context).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            val padding = (20 * resources.displayMetrics.density).toInt()
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(context.getColor(R.color.bg_card))
        }

        // Plan Spinner Label
        val planLabel = android.widget.TextView(context).apply {
            text = "Subscription Plan"
            textSize = 14f
            setTextColor(android.graphics.Color.GRAY)
            setPadding(0, 0, 0, (6 * resources.displayMetrics.density).toInt())
        }
        container.addView(planLabel)

        // Plan Spinner
        val plans = arrayOf("FREE_TRIAL", "BASIC", "PRO", "ENTERPRISE")
        val planSpinner = android.widget.Spinner(context).apply {
            adapter = android.widget.ArrayAdapter(context, R.layout.item_spinner_selected, plans).apply {
                setDropDownViewResource(R.layout.item_spinner_dropdown)
            }
            val index = plans.indexOf(currentPlan)
            if (index >= 0) setSelection(index)
        }
        container.addView(planSpinner)

        // Spacer
        container.addView(View(context).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(1, (16 * resources.displayMetrics.density).toInt())
        })

        // Confirmed Tx Count Label
        val txCountLabel = android.widget.TextView(context).apply {
            text = "Confirmed Transaction Count"
            textSize = 14f
            setTextColor(android.graphics.Color.GRAY)
            setPadding(0, 0, 0, (6 * resources.displayMetrics.density).toInt())
        }
        container.addView(txCountLabel)

        // Confirmed Tx Count Input
        val txCountInput = android.widget.EditText(context).apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setText(client.optInt("txCount", 0).toString())
            setTextColor(context.getColor(R.color.text_primary))
            setHintTextColor(context.getColor(R.color.text_tertiary))
            setBackgroundColor(context.getColor(R.color.bg_input))
        }
        container.addView(txCountInput)

        // Spacer
        container.addView(View(context).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(1, (16 * resources.displayMetrics.density).toInt())
        })

        // Tx Limit Label
        val txLimitLabel = android.widget.TextView(context).apply {
            text = "Plan Transaction Limit"
            textSize = 14f
            setTextColor(android.graphics.Color.GRAY)
            setPadding(0, 0, 0, (6 * resources.displayMetrics.density).toInt())
        }
        container.addView(txLimitLabel)

        // Tx Limit Input
        val txLimitInput = android.widget.EditText(context).apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setText(client.optInt("txLimit", 5).toString())
            setTextColor(context.getColor(R.color.text_primary))
            setHintTextColor(context.getColor(R.color.text_tertiary))
            setBackgroundColor(context.getColor(R.color.bg_input))
        }
        container.addView(txLimitInput)

        // Set Plan Spinner item selection listener to prefill defaults
        planSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                val selected = plans[position]
                val currentInput = txLimitInput.text.toString().trim()
                // If it is empty or matches standard defaults, auto-update it
                if (currentInput.isEmpty() || currentInput == "5" || currentInput == "1000" || currentInput == "3500" || currentInput == "10000") {
                    val defaultLimit = when (selected) {
                        "FREE_TRIAL" -> 5
                        "BASIC" -> 1000
                        "PRO" -> 3500
                        "ENTERPRISE" -> 10000
                        else -> 5
                    }
                    txLimitInput.setText(defaultLimit.toString())
                }
            }
        }

        // Spacer
        container.addView(View(context).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(1, (16 * resources.displayMetrics.density).toInt())
        })

        // Is Free Trial Checkbox
        val trialCheckBox = android.widget.CheckBox(context).apply {
            text = "Mark as Free Trial"
            isChecked = currentIsTrial
            setTextColor(context.getColor(R.color.text_primary))
            buttonTintList = android.content.res.ColorStateList.valueOf(context.getColor(R.color.brand_accent))
        }
        container.addView(trialCheckBox)

        // Spacer
        container.addView(View(context).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(1, (16 * resources.displayMetrics.density).toInt())
        })

        // Expiration Date Label
        val dateLabel = android.widget.TextView(context).apply {
            text = "Expiration Date (Tap below to edit)"
            textSize = 14f
            setTextColor(android.graphics.Color.GRAY)
            setPadding(0, 0, 0, (6 * resources.displayMetrics.density).toInt())
        }
        container.addView(dateLabel)

        // Expiration Date Calendar Picker Button
        val calendar = java.util.Calendar.getInstance()
        if (currentEndsAt.isNotEmpty() && currentEndsAt != "null") {
            try {
                val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                val date = sdf.parse(currentEndsAt)
                if (date != null) {
                    calendar.time = date
                }
            } catch (e: Exception) {}
        } else {
            // Default: 30 days from now
            calendar.add(java.util.Calendar.DAY_OF_YEAR, 30)
        }

        val dateDisplayFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        val dateButton = android.widget.Button(context).apply {
            text = dateDisplayFormat.format(calendar.time)
            setTextColor(context.getColor(R.color.text_on_primary))
            setBackgroundColor(context.getColor(R.color.brand_primary))
            setOnClickListener {
                android.app.DatePickerDialog(
                    context,
                    { _, year, month, dayOfMonth ->
                        calendar.set(java.util.Calendar.YEAR, year)
                        calendar.set(java.util.Calendar.MONTH, month)
                        calendar.set(java.util.Calendar.DAY_OF_MONTH, dayOfMonth)
                        text = dateDisplayFormat.format(calendar.time)
                    },
                    calendar.get(java.util.Calendar.YEAR),
                    calendar.get(java.util.Calendar.MONTH),
                    calendar.get(java.util.Calendar.DAY_OF_MONTH)
                ).show()
            }
        }
        container.addView(dateButton)

        AlertDialog.Builder(context)
            .setTitle("Edit Subscription: " + client.optString("businessName", "Merchant"))
            .setView(container)
            .setPositiveButton("Save Updates") { _, _ ->
                val selectedPlan = planSpinner.selectedItem.toString()
                val isTrial = trialCheckBox.isChecked
                val endsAtTime = calendar.timeInMillis
                val customLimit = txLimitInput.text.toString().toIntOrNull() ?: 5
                val customCount = txCountInput.text.toString().toIntOrNull() ?: 0

                lifecycleScope.launch {
                    binding.swipeRefresh.isRefreshing = true
                    val body = JSONObject().apply {
                        put("subscriptionPlan", selectedPlan)
                        put("isFreeTrial", isTrial)
                        put("txLimit", customLimit)
                        put("txCount", customCount)
                        
                        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                        sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                        put("subscriptionEndsAt", sdf.format(java.util.Date(endsAtTime)))
                    }
                    val response = ApiClient.patch(context, "/api/admin/clients/$id", body)
                    if (response.isSuccessful) {
                        loadMerchants()
                        Toast.makeText(context, "Subscription updated successfully!", Toast.LENGTH_SHORT).show()
                    } else {
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(context, response.errorMessage ?: "Failed to update subscription", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNeutralButton("Expire Now") { _, _ ->
                lifecycleScope.launch {
                    binding.swipeRefresh.isRefreshing = true
                    val body = JSONObject().apply {
                        put("subscriptionPlan", "EXPIRED")
                        put("isFreeTrial", false)
                        val pastDate = System.currentTimeMillis() - 24L * 60L * 60L * 1000L // 1 day ago
                        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                        sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                        put("subscriptionEndsAt", sdf.format(java.util.Date(pastDate)))
                    }
                    val response = ApiClient.patch(context, "/api/admin/clients/$id", body)
                    if (response.isSuccessful) {
                        loadMerchants()
                    } else {
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(context, response.errorMessage ?: "Failed to expire", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton(R.string.btn_cancel, null)
            .show()
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
