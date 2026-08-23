package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.instapaydetector.admin.databinding.FragmentDashboardBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

open class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    private lateinit var recentTxAdapter: TransactionAdapter
    private lateinit var pendingAdapter: PendingApprovalAdapter
    private val recentTransactionsList = mutableListOf<JSONObject>()
    private val pendingApprovalsList = mutableListOf<JSONObject>()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerViews()
        setupStatCardsPlaceholders()

        binding.swipeRefresh.setOnRefreshListener {
            loadDashboardData()
        }

        binding.btnRefresh.setOnClickListener {
            binding.swipeRefresh.isRefreshing = true
            loadDashboardData()
        }

        binding.swipeRefresh.isRefreshing = true
        loadDashboardData()
    }

    private fun setupRecyclerViews() {
        // Recent Transactions
        recentTxAdapter = TransactionAdapter(recentTransactionsList) { sessionId ->
            showForceConfirmDialog(sessionId)
        }
        binding.rvRecentTx.layoutManager = LinearLayoutManager(requireContext())
        binding.rvRecentTx.adapter = recentTxAdapter

        // Pending Approvals
        pendingAdapter = PendingApprovalAdapter(pendingApprovalsList,
            onApprove = { id -> approveClient(id) },
            onReject = { id -> rejectClient(id) }
        )
        binding.rvPending.layoutManager = LinearLayoutManager(requireContext())
        binding.rvPending.adapter = pendingAdapter
    }

    private fun setupStatCardsPlaceholders() {
        // Clients Stat Card
        binding.statClients.tvLabel.text = getString(R.string.stat_total_clients)
        binding.statClients.ivIcon.setImageResource(R.drawable.ic_nav_merchants)
        binding.statClients.ivIcon.setColorFilter(requireContext().getColor(R.color.accent_violet))
        binding.statClients.iconContainer.setBackgroundResource(R.drawable.bg_avatar_pending)

        // Revenue Stat Card
        binding.statRevenue.tvLabel.text = getString(R.string.stat_revenue_today)
        binding.statRevenue.tvUnit.text = getString(R.string.unit_egp)
        binding.statRevenue.ivIcon.setImageResource(R.drawable.ic_nav_transactions)
        binding.statRevenue.ivIcon.setColorFilter(requireContext().getColor(R.color.accent_emerald))
        binding.statRevenue.iconContainer.setBackgroundResource(R.drawable.bg_avatar_confirmed)

        // Volume Stat Card
        binding.statVolume.tvLabel.text = getString(R.string.stat_volume_7d)
        binding.statVolume.tvUnit.text = getString(R.string.unit_egp)
        binding.statVolume.ivIcon.setImageResource(R.drawable.ic_export)
        binding.statVolume.ivIcon.setColorFilter(requireContext().getColor(R.color.accent_blue))
        binding.statVolume.iconContainer.setBackgroundResource(R.drawable.bg_avatar_expired)

        // Pending Stat Card
        binding.statPending.tvLabel.text = getString(R.string.stat_pending)
        binding.statPending.tvUnit.text = getString(R.string.unit_egp)
        binding.statPending.ivIcon.setImageResource(R.drawable.ic_alert)
        binding.statPending.ivIcon.setColorFilter(requireContext().getColor(R.color.accent_amber))
        binding.statPending.iconContainer.setBackgroundResource(R.drawable.bg_status_pending)
    }

    private fun loadDashboardData() {
        lifecycleScope.launch {
            // Load stats & recent
            val dashResponse = ApiClient.get(requireContext(), "/api/admin/dashboard")
            if (dashResponse.isSuccessful && dashResponse.json != null) {
                val json = dashResponse.json
                val stats = json.optJSONObject("stats")
                val recent = json.optJSONArray("recent") ?: JSONArray()

                if (stats != null) {
                    bindStats(stats)
                }

                recentTransactionsList.clear()
                for (i in 0 until recent.length()) {
                    recentTransactionsList.add(recent.getJSONObject(i))
                }
                recentTxAdapter.notifyDataSetChanged()
                binding.tvEmptyTx.visibility = if (recentTransactionsList.isEmpty()) View.VISIBLE else View.GONE
            } else if (dashResponse.isUnauthorized) {
                handleUnauthorized()
            } else {
                Toast.makeText(requireContext(), dashResponse.errorMessage ?: "Dashboard fetch failed", Toast.LENGTH_SHORT).show()
            }

            // Load clients for pending approvals list
            val clientsResponse = ApiClient.get(requireContext(), "/api/admin/clients")
            binding.swipeRefresh.isRefreshing = false
            if (clientsResponse.isSuccessful && clientsResponse.json != null) {
                val clients = clientsResponse.json.optJSONArray("clients") ?: JSONArray()
                pendingApprovalsList.clear()
                for (i in 0 until clients.length()) {
                    val client = clients.getJSONObject(i)
                    if (client.optString("approvalStatus") == "PENDING") {
                        pendingApprovalsList.add(client)
                    }
                }
                pendingAdapter.notifyDataSetChanged()

                if (pendingApprovalsList.isNotEmpty()) {
                    binding.cardPendingApprovals.visibility = View.VISIBLE
                    binding.tvPendingTitle.text = getString(R.string.section_pending_approvals) + " (${pendingApprovalsList.size})"
                } else {
                    binding.cardPendingApprovals.visibility = View.GONE
                }
            }
        }
    }

    private fun bindStats(stats: JSONObject) {
        val totalClients = stats.optInt("totalClients", 0)
        val activeClients = stats.optInt("activeClients", 0)
        binding.statClients.tvValue.text = totalClients.toString()
        binding.statClients.tvSub.text = getString(R.string.label_active_accounts, activeClients)

        val today = stats.optJSONObject("today")
        if (today != null) {
            val count = today.optInt("count", 0)
            val volume = today.optDouble("totalEgp", 0.0)
            binding.statRevenue.tvValue.text = String.format("%.2f", volume)
            binding.statRevenue.tvSub.text = if (count == 1) getString(R.string.label_transaction_singular, count) else getString(R.string.label_transactions_count, count)
        }

        val sevenDays = stats.optJSONObject("sevenDays")
        if (sevenDays != null) {
            val count = sevenDays.optInt("count", 0)
            val volume = sevenDays.optDouble("totalEgp", 0.0)
            binding.statVolume.tvValue.text = String.format("%.2f", volume)
            binding.statVolume.tvSub.text = if (count == 1) getString(R.string.label_transaction_singular, count) else getString(R.string.label_transactions_count, count)
        }

        val pending = stats.optJSONObject("pending")
        if (pending != null) {
            val count = pending.optInt("count", 0)
            val volume = pending.optDouble("totalEgp", 0.0)
            binding.statPending.tvValue.text = String.format("%.2f", volume)
            binding.statPending.tvSub.text = if (count == 1) getString(R.string.label_transaction_singular, count) else getString(R.string.label_transactions_count, count)
        }
    }

    private fun approveClient(id: String) {
        lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            val response = ApiClient.post(requireContext(), "/api/admin/clients/$id/approve", JSONObject())
            if (response.isSuccessful) {
                loadDashboardData()
            } else {
                binding.swipeRefresh.isRefreshing = false
                Toast.makeText(requireContext(), response.errorMessage ?: "Failed to approve", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun rejectClient(id: String) {
        AlertDialog.Builder(requireContext())
            .setMessage(R.string.confirm_reject_merchant)
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_reject) { _, _ ->
                lifecycleScope.launch {
                    binding.swipeRefresh.isRefreshing = true
                    val response = ApiClient.post(requireContext(), "/api/admin/clients/$id/reject", JSONObject())
                    if (response.isSuccessful) {
                        loadDashboardData()
                    } else {
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(requireContext(), response.errorMessage ?: "Failed to reject", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .show()
    }

    private fun showForceConfirmDialog(sessionId: String) {
        AlertDialog.Builder(requireContext())
            .setMessage(R.string.confirm_force_confirm)
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_force_confirm) { _, _ ->
                lifecycleScope.launch {
                    binding.swipeRefresh.isRefreshing = true
                    val response = ApiClient.post(requireContext(), "/api/admin/transactions/$sessionId/confirm", JSONObject())
                    if (response.isSuccessful) {
                        Toast.makeText(requireContext(), getString(R.string.toast_confirmed), Toast.LENGTH_SHORT).show()
                        loadDashboardData()
                    } else {
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(requireContext(), response.errorMessage ?: "Failed to confirm", Toast.LENGTH_LONG).show()
                    }
                }
            }
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
