package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.instapaydetector.admin.databinding.DialogCreateMerchantBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

class CreateMerchantBottomSheet(
    private val onSaveSuccess: () -> Unit
) : BottomSheetDialogFragment() {

    private var _binding: DialogCreateMerchantBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogCreateMerchantBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnCancel.setOnClickListener {
            dismiss()
        }

        binding.btnSave.setOnClickListener {
            handleSave()
        }
    }

    private fun handleSave() {
        val businessName = binding.etBusinessName.text?.toString()?.trim() ?: ""
        val instapayHandle = binding.etInstapayHandle.text?.toString()?.trim() ?: ""
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val webhookUrl = binding.etWebhookUrl.text?.toString()?.trim() ?: ""
        val ttlStr = binding.etCheckoutTtl.text?.toString()?.trim() ?: "10"

        if (businessName.isEmpty() || instapayHandle.isEmpty() || email.isEmpty()) {
            Toast.makeText(requireContext(), getString(R.string.error_invalid_fields), Toast.LENGTH_SHORT).show()
            return
        }

        val checkoutTtl = ttlStr.toIntOrNull() ?: 10

        val requestBody = JSONObject().apply {
            put("businessName", businessName)
            put("instapayHandle", instapayHandle)
            put("email", email)
            if (webhookUrl.isNotEmpty()) {
                put("webhookUrl", webhookUrl)
            } else {
                put("webhookUrl", JSONObject.NULL)
            }
            put("checkoutTtlMin", checkoutTtl)
        }

        binding.btnSave.isEnabled = false
        binding.btnSave.text = "Saving…"

        lifecycleScope.launch {
            val response = ApiClient.post(requireContext(), "/api/admin/clients", requestBody)
            if (response.isSuccessful) {
                Toast.makeText(requireContext(), "Merchant created successfully", Toast.LENGTH_SHORT).show()
                onSaveSuccess()
                dismiss()
            } else {
                binding.btnSave.isEnabled = true
                binding.btnSave.text = getString(R.string.btn_save_merchant)
                val error = response.errorMessage ?: "Failed to create merchant"
                Toast.makeText(requireContext(), error, Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
