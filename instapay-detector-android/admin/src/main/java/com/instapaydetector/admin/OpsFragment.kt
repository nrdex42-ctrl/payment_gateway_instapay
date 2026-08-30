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
        binding.cardMerchants.tvLabel.text = "Total Merchants"
        binding.cardMerchants.tvValue.text = "0"
        binding.cardReady.tvLabel.text = getString(R.string.label_ready_accounts)
        binding.cardReady.tvValue.text = "0"
        binding.cardIssues.tvLabel.text = getString(R.string.label_open_issues)
        binding.cardIssues.tvValue.text = "0"
        binding.cardPendingTx.tvLabel.text = getString(R.string.label_pending_tx)
        binding.cardPendingTx.tvValue.text = "0"

        binding.swipeRefresh.setOnRefreshListener { loadOpsData() }

        binding.btnActionApprovals.setOnClickListener {
            (activity as? MainActivity)?.fetchPendingApprovals()
            val sheet = PendingApprovalsBottomSheet(
                onActionCompleted = { loadOpsData() },
                onNavigateToMerchants = {
                    (activity as? MainActivity)?.findViewById<androidx.viewpager2.widget.ViewPager2>(R.id.view_pager)?.currentItem = 1
                }
            )
            sheet.show(parentFragmentManager, "PendingApprovalsBottomSheet")
        }

        binding.btnActionNotify.setOnClickListener {
            // Navigate to notifications tab (index 3)
            (activity as? MainActivity)?.findViewById<androidx.viewpager2.widget.ViewPager2>(R.id.view_pager)?.currentItem = 3
        }

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

            var totalMerchants = 0
            var readyMerchants = 0
            var openIssues = 0

            if (clientsRes.isSuccessful && clientsRes.json != null) {
                val clients = clientsRes.json.optJSONArray("clients") ?: JSONArray()
                totalMerchants = clients.length()
                var pending = 0
                var setupIssues = 0
                var subscriptionIssues = 0

                for (i in 0 until clients.length()) {
                    val client = clients.getJSONObject(i)
                    val isActive = client.optBoolean("isActive", false)
                    val status = client.optString("approvalStatus", "")
                    val hasWebhook = client.optString("webhookUrl").isNotBlank()
                    val hasToken = client.optString("detectToken").isNotBlank()

                    if (isActive && hasWebhook && hasToken) {
                        readyMerchants++
                    }

                    if (status == "PENDING") pending++
                    if (!hasWebhook || !hasToken) setupIssues++

                    val endsAt = client.optString("subscriptionEndsAt", "")
                    if (endsAt.isNotEmpty() && endsAt != "null") {
                        try {
                            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                            val date = sdf.parse(endsAt)
                            if (date != null && date.time < System.currentTimeMillis()) {
                                subscriptionIssues++
                            }
                        } catch (e: Exception) {}
                    }
                }

                openIssues = pending + setupIssues + subscriptionIssues

                binding.cardMerchants.tvValue.text = totalMerchants.toString()
                binding.cardReady.tvValue.text = readyMerchants.toString()
                binding.cardIssues.tvValue.text = openIssues.toString()
            }

            var pendingTxCount = 0
            if (dashRes.isSuccessful && dashRes.json != null) {
                val stats = dashRes.json.optJSONObject("stats")
                val pending = stats?.optJSONObject("pending")
                pendingTxCount = pending?.optInt("count", 0) ?: 0
                binding.cardPendingTx.tvValue.text = pendingTxCount.toString()
            }

            // Calculate overall health score (0 - 100)
            val readinessPercent = if (totalMerchants > 0) ((readyMerchants.toDouble() / totalMerchants) * 100).toInt() else 100
            val penalties = (openIssues * 8) + (pendingTxCount * 2)
            val healthScore = (readinessPercent - penalties).coerceIn(0, 100)

            binding.tvHealthScoreNum.text = "$healthScore%"
            binding.pbHealth.progress = healthScore

            if (healthScore >= 80) {
                binding.tvRiskPill.text = getString(R.string.label_risk_healthy)
                binding.tvRiskPill.setTextColor(requireContext().getColor(R.color.status_confirmed))
                binding.tvRiskPill.setBackgroundResource(R.drawable.bg_status_confirmed)
                binding.tvHealthReadiness.text = "Platform is operating reliably"
                binding.pbHealth.progressTintList = android.content.res.ColorStateList.valueOf(requireContext().getColor(R.color.status_confirmed))
            } else if (healthScore >= 50) {
                binding.tvRiskPill.text = getString(R.string.label_risk_attention)
                binding.tvRiskPill.setTextColor(requireContext().getColor(R.color.status_pending))
                binding.tvRiskPill.setBackgroundResource(R.drawable.bg_status_pending)
                binding.tvHealthReadiness.text = "$openIssues issue(s) need attention"
                binding.pbHealth.progressTintList = android.content.res.ColorStateList.valueOf(requireContext().getColor(R.color.status_pending))
            } else {
                binding.tvRiskPill.text = getString(R.string.label_risk_critical)
                binding.tvRiskPill.setTextColor(requireContext().getColor(R.color.status_denied))
                binding.tvRiskPill.setBackgroundResource(R.drawable.bg_status_denied)
                binding.tvHealthReadiness.text = "Action required: $openIssues issues"
                binding.pbHealth.progressTintList = android.content.res.ColorStateList.valueOf(requireContext().getColor(R.color.status_denied))
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
