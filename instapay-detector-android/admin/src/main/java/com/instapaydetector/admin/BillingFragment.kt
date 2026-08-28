package com.instapaydetector.admin

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
import com.instapaydetector.admin.databinding.FragmentBillingBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

class BillingFragment : Fragment() {

    private var _binding: FragmentBillingBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBillingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.btnRefreshPlans.setOnClickListener { loadPlans() }
        loadPlans()
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
            } else if (response.isUnauthorized) {
                handleUnauthorized()
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
        val padding = (18 * resources.displayMetrics.density).toInt()
        val layout = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding / 2)
            setBackgroundColor(ctx.getColor(R.color.bg_card))
        }

        val priceInput = EditText(ctx).apply {
            hint = "Price (EGP)"
            setText("%.0f".format(currentPrice))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            textSize = 13f
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
        }
        layout.addView(priceInput)

        val limitInput = EditText(ctx).apply {
            hint = "Max Transactions"
            setText("$currentLimit")
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            textSize = 13f
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
                Toast.makeText(requireContext(), "Plan updated", Toast.LENGTH_SHORT).show()
                loadPlans()
            } else if (response.isUnauthorized) {
                handleUnauthorized()
            } else {
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to update plan",
                    Toast.LENGTH_SHORT
                ).show()
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
