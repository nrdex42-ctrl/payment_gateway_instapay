package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.admin.databinding.FragmentOpsBinding
import kotlinx.coroutines.launch
import org.json.JSONArray

open class OpsFragment : Fragment() {

    private var _binding: FragmentOpsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOpsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.cardMerchants.tvLabel.text = "Merchants"
        binding.cardMerchants.tvValue.text = "0"
        binding.cardReady.tvLabel.text = "Ready merchants"
        binding.cardReady.tvValue.text = "0"
        binding.cardIssues.tvLabel.text = "Open issues"
        binding.cardIssues.tvValue.text = "0"
        binding.cardPendingTx.tvLabel.text = "Pending tx"
        binding.cardPendingTx.tvValue.text = "0"

        binding.swipeRefresh.setOnRefreshListener { loadOpsData() }
        binding.swipeRefresh.isRefreshing = true
        loadOpsData()
    }

    private fun loadOpsData() {
        lifecycleScope.launch {
            val clientsRes = ApiClient.get(requireContext(), "/api/admin/clients")
            val dashRes = ApiClient.get(requireContext(), "/api/admin/dashboard")
            binding.swipeRefresh.isRefreshing = false

            if (clientsRes.isUnauthorized || dashRes.isUnauthorized) {
                handleUnauthorized()
                return@launch
            }

            if (clientsRes.isSuccessful && clientsRes.json != null) {
                val clients = clientsRes.json.optJSONArray("clients") ?: JSONArray()
                var active = 0
                var pending = 0
                var setupIssues = 0
                for (i in 0 until clients.length()) {
                    val client = clients.getJSONObject(i)
                    if (client.optBoolean("isActive", false)) active++
                    if (client.optString("approvalStatus") == "PENDING") pending++
                    if (client.optString("webhookUrl").isBlank() || client.optString("detectToken").isBlank()) setupIssues++
                }
                binding.cardMerchants.tvValue.text = clients.length().toString()
                binding.cardReady.tvValue.text = active.toString()
                binding.cardIssues.tvValue.text = (pending + setupIssues).toString()
            }

            if (dashRes.isSuccessful && dashRes.json != null) {
                val stats = dashRes.json.optJSONObject("stats")
                val pending = stats?.optJSONObject("pending")
                binding.cardPendingTx.tvValue.text = pending?.optInt("count", 0)?.toString() ?: "0"
                binding.tvOpsState.text = "Ready"
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
