package com.instapaydetector.admin

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.admin.databinding.FragmentSettingsBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

open class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        displayStaticInfo()
        setupListeners()
        loadSettings()
    }

    private fun displayStaticInfo() {
        val context = requireContext()
        binding.tvGatewayUrl.text = ApiClient.getGatewayUrl(context)
        binding.tvPortalHash.text = ApiClient.getPortalHash(context)

        try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            binding.tvVersion.text = packageInfo.versionName
        } catch (e: Exception) {
            binding.tvVersion.text = "1.0.0"
        }
    }

    private fun setupListeners() {
        // DST Mode selection listener
        binding.chipGroupDst.setOnCheckedStateChangeListener { _, checkedIds ->
            val newMode = when (checkedIds.firstOrNull()) {
                R.id.chip_dst_summer -> "SUMMER"
                R.id.chip_dst_winter -> "WINTER"
                else -> "AUTO"
            }
            updateDstMode(newMode)
        }

        // Logout listener
        binding.btnLogout.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setMessage(R.string.confirm_logout)
                .setNegativeButton(R.string.btn_cancel, null)
                .setPositiveButton(R.string.btn_logout) { _, _ ->
                    logout()
                }
                .show()
        }

        // Plans Manager – Load Plans button
        binding.btnRefreshPlans.setOnClickListener { loadPlans() }
    }

    private fun loadSettings() {
        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), "/api/settings")
            if (response.isSuccessful && response.json != null) {
                val json = response.json
                val dstMode = json.optString("dstMode", "AUTO")
                val currentEgyptTime = json.optString("currentEgyptTime", "")

                binding.tvEgyptTime.text = currentEgyptTime

                // Disable listener temporarily to prevent cycle
                binding.chipGroupDst.setOnCheckedStateChangeListener(null)
                when (dstMode) {
                    "SUMMER" -> binding.chipGroupDst.check(R.id.chip_dst_summer)
                    "WINTER" -> binding.chipGroupDst.check(R.id.chip_dst_winter)
                    else -> binding.chipGroupDst.check(R.id.chip_dst_auto)
                }
                setupListeners() // Restore listeners
            } else if (response.isUnauthorized) {
                handleUnauthorized()
            }
        }

        // Auto-load plans on startup
        loadPlans()
    }

    private fun updateDstMode(newMode: String) {
        lifecycleScope.launch {
            val body = JSONObject().apply {
                put("dstMode", newMode)
            }
            val response = ApiClient.post(requireContext(), "/api/settings", body)
            if (response.isSuccessful && response.json != null) {
                val json = response.json
                binding.tvEgyptTime.text = json.optString("currentEgyptTime", "")
                Toast.makeText(requireContext(), "DST Mode updated successfully", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(requireContext(), response.errorMessage ?: "Failed to update DST Mode", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadPlans() {
        binding.btnRefreshPlans.text = "Loading…"
        binding.btnRefreshPlans.isEnabled = false

        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), "/api/admin/plans")
            binding.btnRefreshPlans.text = "Refresh Plans"
            binding.btnRefreshPlans.isEnabled = true

            if (response.isSuccessful && response.json != null) {
                val plans = response.json.optJSONArray("plans") ?: return@launch
                binding.plansContainer.removeAllViews()

                for (i in 0 until plans.length()) {
                    val plan = plans.getJSONObject(i)
                    val name = plan.optString("name", "Unknown")
                    val price = plan.optDouble("priceEgp", 0.0)
                    val maxTx = plan.optInt("maxTransactions", 0)

                    val itemView = LayoutInflater.from(requireContext())
                        .inflate(R.layout.item_plan_card, binding.plansContainer, false)

                    itemView.findViewById<android.widget.TextView>(R.id.tvPlanName).text =
                        name.replace("_", " ")
                    itemView.findViewById<android.widget.TextView>(R.id.tvPlanPrice).text =
                        if (price <= 0) "Free" else "EGP %.0f/mo".format(price)
                    itemView.findViewById<android.widget.TextView>(R.id.tvPlanLimit).text =
                        "$maxTx transactions"

                    itemView.findViewById<android.widget.ImageButton>(R.id.btnEditPlan)
                        .setOnClickListener {
                            showEditPlanDialog(name, price, maxTx)
                        }

                    binding.plansContainer.addView(itemView)
                }
            } else {
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to load plans",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun showEditPlanDialog(planName: String, currentPrice: Double, currentLimit: Int) {
        val ctx = requireContext()
        val layout = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(60, 40, 60, 20)
            setBackgroundColor(ctx.getColor(R.color.bg_card))
        }

        val priceInput = EditText(ctx).apply {
            hint = "Price (EGP)"
            setText("%.0f".format(currentPrice))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
        }
        layout.addView(priceInput)

        val limitInput = EditText(ctx).apply {
            hint = "Max Transactions"
            setText("$currentLimit")
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
        }
        layout.addView(limitInput)

        AlertDialog.Builder(ctx)
            .setTitle("Edit Plan: ${planName.replace("_", " ")}")
            .setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ ->
                val newPrice = priceInput.text.toString().toDoubleOrNull() ?: currentPrice
                val newLimit = limitInput.text.toString().toIntOrNull() ?: currentLimit
                updatePlan(planName, newPrice, newLimit)
            }
            .show()
    }

    private fun updatePlan(planName: String, priceEgp: Double, maxTransactions: Int) {
        lifecycleScope.launch {
            val body = JSONObject().apply {
                put("name", planName)
                put("priceEgp", priceEgp)
                put("maxTransactions", maxTransactions)
            }
            val response = ApiClient.patch(requireContext(), "/api/admin/plans", body)
            if (response.isSuccessful) {
                Toast.makeText(requireContext(), "Plan updated!", Toast.LENGTH_SHORT).show()
                loadPlans() // Refresh
            } else {
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to update plan",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun logout() {
        ApiClient.clearPrefs(requireContext())
        startActivity(Intent(requireActivity(), SetupActivity::class.java))
        requireActivity().finish()
    }

    private fun handleUnauthorized() {
        ApiClient.clearPrefs(requireContext())
        startActivity(Intent(requireActivity(), SetupActivity::class.java))
        requireActivity().finish()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
