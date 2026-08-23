package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.instapaydetector.admin.databinding.FragmentOpsBinding
import com.instapaydetector.admin.databinding.ItemOpsEntryBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

open class OpsFragment : Fragment() {

    private var _binding: FragmentOpsBinding? = null
    private val binding get() = _binding!!

    private val merchants = mutableListOf<JSONObject>()
    private val webhookItems = mutableListOf<OpsEntry>()
    private val auditItems = mutableListOf<OpsEntry>()

    private lateinit var webhookAdapter: OpsEntryAdapter
    private lateinit var auditAdapter: OpsEntryAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOpsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupLists()
        setupListeners()
        binding.swipeRefresh.setOnRefreshListener { loadOpsData() }
        binding.swipeRefresh.isRefreshing = true
        loadOpsData()
    }

    private fun setupLists() {
        webhookAdapter = OpsEntryAdapter(webhookItems)
        auditAdapter = OpsEntryAdapter(auditItems)

        binding.rvWebhooks.layoutManager = LinearLayoutManager(requireContext())
        binding.rvWebhooks.adapter = webhookAdapter

        binding.rvAudit.layoutManager = LinearLayoutManager(requireContext())
        binding.rvAudit.adapter = auditAdapter
    }

    private fun setupListeners() {
        binding.btnSendNotification.setOnClickListener { sendNotification() }
    }

    private fun loadOpsData() {
        lifecycleScope.launch {
            val headersReady = true
            if (!headersReady) return@launch

            val clientsRes = ApiClient.get(requireContext(), "/api/admin/clients")
            val webhooksRes = ApiClient.get(requireContext(), "/api/admin/webhooks?limit=10")
            val auditRes = ApiClient.get(requireContext(), "/api/admin/audit?limit=10")

            binding.swipeRefresh.isRefreshing = false

            if (clientsRes.isUnauthorized || webhooksRes.isUnauthorized || auditRes.isUnauthorized) {
                handleUnauthorized()
                return@launch
            }

            if (clientsRes.isSuccessful && clientsRes.json != null) {
                val array = clientsRes.json.optJSONArray("clients") ?: JSONArray()
                merchants.clear()
                for (i in 0 until array.length()) merchants.add(array.getJSONObject(i))
                binding.tvMerchantsCount.text = merchants.size.toString()
                populateMerchantSpinner()
            }

            if (webhooksRes.isSuccessful && webhooksRes.json != null) {
                val array = webhooksRes.json.optJSONArray("logs") ?: JSONArray()
                webhookItems.clear()
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    val status = if (item.optBoolean("isSuccess", false)) "OK" else "FAIL"
                    webhookItems.add(
                        OpsEntry(
                            title = "${item.optString("businessName")} · ${item.optString("event")}",
                            subtitle = item.optString("url"),
                            meta = "${item.optInt("statusCode", 0)} • $status • ${item.optString("createdAt")}",
                            badge = if (item.optBoolean("isSuccess", false)) "SUCCESS" else "ERROR",
                            badgeTone = if (item.optBoolean("isSuccess", false)) Tone.SUCCESS else Tone.ERROR
                        )
                    )
                }
                webhookAdapter.notifyDataSetChanged()
            }

            if (auditRes.isSuccessful && auditRes.json != null) {
                val array = auditRes.json.optJSONArray("logs") ?: JSONArray()
                auditItems.clear()
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    auditItems.add(
                        OpsEntry(
                            title = item.optString("action"),
                            subtitle = item.optString("details"),
                            meta = item.optString("createdAt"),
                            badge = "AUDIT",
                            badgeTone = Tone.NEUTRAL
                        )
                    )
                }
                auditAdapter.notifyDataSetChanged()
            }

            binding.tvOpsState.text = if (merchants.isEmpty()) "Idle" else "Ready"
        }
    }

    private fun populateMerchantSpinner() {
        val labels = buildList {
            add(getString(R.string.ops_all_merchants))
            merchants.forEach { merchant ->
                add("${merchant.optString("businessName")} · ${merchant.optString("id").take(8)}")
            }
        }
        binding.spinnerMerchant.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            labels
        )
    }

    private fun sendNotification() {
        val title = binding.etNotificationTitle.text?.toString()?.trim().orEmpty()
        val message = binding.etNotificationMessage.text?.toString()?.trim().orEmpty()
        val merchantIndex = binding.spinnerMerchant.selectedItemPosition
        val severity = when (binding.chipGroupSeverity.checkedChipId) {
            R.id.chip_success -> "SUCCESS"
            R.id.chip_warning -> "WARNING"
            R.id.chip_urgent -> "URGENT"
            else -> "INFO"
        }

        if (title.isEmpty() || message.isEmpty()) {
            showNotificationResult(getString(R.string.ops_notification_failed), isError = true)
            return
        }
        if (merchantIndex <= 0 || merchants.isEmpty()) {
            showNotificationResult("Select a merchant.", isError = true)
            return
        }

        val clientId = merchants[merchantIndex - 1].optString("id")
        binding.btnSendNotification.isEnabled = false
        binding.btnSendNotification.text = getString(R.string.loading)

        lifecycleScope.launch {
            val body = JSONObject().apply {
                put("clientId", clientId)
                put("title", title)
                put("message", message)
                put("severity", severity)
            }
            val response = ApiClient.post(requireContext(), "/api/admin/notifications", body)
            binding.btnSendNotification.isEnabled = true
            binding.btnSendNotification.text = getString(R.string.ops_send_notification)

            if (response.isSuccessful) {
                binding.etNotificationTitle.setText("")
                binding.etNotificationMessage.setText("")
                showNotificationResult(getString(R.string.ops_notification_sent), isError = false)
            } else {
                showNotificationResult(response.errorMessage ?: getString(R.string.ops_notification_failed), isError = true)
            }
        }
    }

    private fun showNotificationResult(message: String, isError: Boolean) {
        binding.tvNotificationResult.visibility = View.VISIBLE
        binding.tvNotificationResult.text = message
        binding.tvNotificationResult.setTextColor(
            requireContext().getColor(if (isError) R.color.status_denied else R.color.status_confirmed)
        )
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

    private data class OpsEntry(
        val title: String,
        val subtitle: String,
        val meta: String,
        val badge: String,
        val badgeTone: Tone
    )

    private enum class Tone { SUCCESS, ERROR, NEUTRAL }

    private class OpsEntryAdapter(
        private val items: List<OpsEntry>
    ) : androidx.recyclerview.widget.RecyclerView.Adapter<OpsEntryAdapter.VH>() {
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val binding = ItemOpsEntryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
            return VH(binding)
        }

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(holder: VH, position: Int) {
            holder.bind(items[position])
        }

        inner class VH(private val binding: ItemOpsEntryBinding) : androidx.recyclerview.widget.RecyclerView.ViewHolder(binding.root) {
            fun bind(item: OpsEntry) {
                binding.tvTitle.text = item.title
                binding.tvSubtitle.text = item.subtitle
                binding.tvMeta.text = item.meta
                binding.tvBadge.text = item.badge
                val context = binding.root.context
                when (item.badgeTone) {
                    Tone.SUCCESS -> {
                        binding.tvBadge.setTextColor(context.getColor(R.color.status_confirmed))
                        binding.tvBadge.setBackgroundColor(context.getColor(R.color.status_confirmed_bg))
                    }
                    Tone.ERROR -> {
                        binding.tvBadge.setTextColor(context.getColor(R.color.status_denied))
                        binding.tvBadge.setBackgroundColor(context.getColor(R.color.status_denied_bg))
                    }
                    Tone.NEUTRAL -> {
                        binding.tvBadge.setTextColor(context.getColor(R.color.text_secondary))
                        binding.tvBadge.setBackgroundColor(context.getColor(R.color.bg_input))
                    }
                }
            }
        }
    }
}
