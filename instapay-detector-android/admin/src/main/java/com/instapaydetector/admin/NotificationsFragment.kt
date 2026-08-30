package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.admin.databinding.FragmentNotificationsBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class NotificationsFragment : Fragment() {
    private var _binding: FragmentNotificationsBinding? = null
    private val binding get() = _binding!!
    private val merchants = mutableListOf<JSONObject>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentNotificationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        setupListeners()
        binding.swipeRefresh.setOnRefreshListener { loadMerchants() }
        binding.swipeRefresh.isRefreshing = true
        loadMerchants()
    }

    private fun setupListeners() {
        binding.btnSendNotification.setOnClickListener { sendNotification() }
    }

    private fun loadMerchants() {
        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), "/api/admin/clients")
            binding.swipeRefresh.isRefreshing = false
            if (response.isUnauthorized) return@launch handleUnauthorized()
            if (response.isSuccessful && response.json != null) {
                val array = response.json.optJSONArray("clients") ?: JSONArray()
                merchants.clear()
                for (i in 0 until array.length()) merchants.add(array.getJSONObject(i))
                val labels = buildList {
                    add(getString(R.string.ops_all_merchants))
                    merchants.forEach { add("${it.optString("businessName")} · ${it.optString("email")}") }
                }
                binding.spinnerMerchant.adapter = ArrayAdapter(requireContext(), R.layout.item_spinner_selected, labels).apply {
                    setDropDownViewResource(R.layout.item_spinner_dropdown)
                }
            } else {
                showResult(response.errorMessage ?: "Failed to load merchants.", true)
            }
        }
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

        val channel = when (binding.chipGroupChannel.checkedChipId) {
            R.id.chip_channel_detector -> "DETECTOR"
            R.id.chip_channel_email -> "EMAIL"
            else -> "BOTH"
        }

        if (title.isEmpty() || message.isEmpty()) {
            return showResult("Title and message are required.", true)
        }

        // merchantIndex 0 is "ALL" broadcast
        val targetClientId = if (merchantIndex == 0) {
            "ALL"
        } else if (merchantIndex > 0 && merchantIndex <= merchants.size) {
            merchants[merchantIndex - 1].optString("id")
        } else {
            return showResult("Please select a valid merchant.", true)
        }

        binding.btnSendNotification.isEnabled = false
        binding.btnSendNotification.text = getString(R.string.loading)

        lifecycleScope.launch {
            val body = JSONObject().apply {
                put("clientId", targetClientId)
                put("channel", channel)
                put("title", title)
                put("message", message)
                put("severity", severity)
            }
            val response = ApiClient.post(requireContext(), "/api/admin/notifications", body)
            binding.btnSendNotification.isEnabled = true
            binding.btnSendNotification.text = getString(R.string.ops_send_notification)

            if (response.isSuccessful && response.json != null) {
                binding.etNotificationTitle.setText("")
                binding.etNotificationMessage.setText("")
                val serverMsg = response.json.optString("message", getString(R.string.ops_notification_sent))
                showResult(serverMsg, false)
            } else {
                showResult(response.errorMessage ?: getString(R.string.ops_notification_failed), true)
            }
        }
    }

    private fun showResult(message: String, isError: Boolean) {
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
}
