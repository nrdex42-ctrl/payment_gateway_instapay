package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.instapaydetector.admin.databinding.BottomSheetPendingApprovalsBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class PendingApprovalsBottomSheet(
    private val onActionCompleted: (() -> Unit)? = null,
    private val onNavigateToMerchants: (() -> Unit)? = null
) : BottomSheetDialogFragment() {

    private var _binding: BottomSheetPendingApprovalsBinding? = null
    private val binding get() = _binding!!

    private val pendingList = mutableListOf<JSONObject>()
    private lateinit var adapter: PendingApprovalAdapter

    override fun getTheme(): Int = R.style.Theme_InstaPayAdmin

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = BottomSheetPendingApprovalsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = PendingApprovalAdapter(
            items = pendingList,
            onApprove = { id -> approveMerchant(id) },
            onReject = { id -> rejectMerchant(id) }
        )

        binding.rvPendingMerchants.layoutManager = LinearLayoutManager(requireContext())
        binding.rvPendingMerchants.adapter = adapter

        binding.btnCloseSheet.setOnClickListener {
            dismiss()
        }

        binding.btnOpenMerchantsTab.setOnClickListener {
            dismiss()
            onNavigateToMerchants?.invoke()
        }

        loadPendingMerchants()
    }

    private fun loadPendingMerchants() {
        binding.progressLoading.visibility = View.VISIBLE
        binding.layoutEmptyState.visibility = View.GONE

        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), "/api/admin/clients")
            binding.progressLoading.visibility = View.GONE

            if (response.isSuccessful && response.json != null) {
                val array = response.json.optJSONArray("clients") ?: JSONArray()
                pendingList.clear()
                for (i in 0 until array.length()) {
                    val client = array.getJSONObject(i)
                    if (client.optString("approvalStatus", "APPROVED").uppercase() == "PENDING") {
                        pendingList.add(client)
                    }
                }
                adapter.notifyDataSetChanged()
                updateUIState()
            } else {
                updateUIState()
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to load pending merchants",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun updateUIState() {
        val count = pendingList.size
        binding.tvSheetTitle.text = if (count > 0) {
            "${getString(R.string.sheet_pending_title)} ($count)"
        } else {
            getString(R.string.sheet_pending_title)
        }

        if (count == 0) {
            binding.rvPendingMerchants.visibility = View.GONE
            binding.layoutEmptyState.visibility = View.VISIBLE
        } else {
            binding.rvPendingMerchants.visibility = View.VISIBLE
            binding.layoutEmptyState.visibility = View.GONE
        }
    }

    private fun approveMerchant(id: String) {
        binding.progressLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            val response = ApiClient.post(requireContext(), "/api/admin/clients/$id/approve", JSONObject())
            binding.progressLoading.visibility = View.GONE

            if (response.isSuccessful) {
                AdminNotificationHelper.dismissMerchantNotification(requireContext(), id)
                Toast.makeText(requireContext(), getString(R.string.toast_merchant_approved), Toast.LENGTH_SHORT).show()
                pendingList.removeAll { it.optString("id") == id }
                adapter.notifyDataSetChanged()
                updateUIState()
                onActionCompleted?.invoke()
            } else {
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to approve merchant",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun rejectMerchant(id: String) {
        binding.progressLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            val response = ApiClient.post(requireContext(), "/api/admin/clients/$id/reject", JSONObject())
            binding.progressLoading.visibility = View.GONE

            if (response.isSuccessful) {
                AdminNotificationHelper.dismissMerchantNotification(requireContext(), id)
                Toast.makeText(requireContext(), getString(R.string.toast_merchant_rejected), Toast.LENGTH_SHORT).show()
                pendingList.removeAll { it.optString("id") == id }
                adapter.notifyDataSetChanged()
                updateUIState()
                onActionCompleted?.invoke()
            } else {
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to reject merchant",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
