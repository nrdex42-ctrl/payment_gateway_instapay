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
                val clientObj = response.json?.optJSONObject("client")
                val generatedPassword = clientObj?.optString("password", "") ?: ""
                
                val hostActivity = requireActivity()
                onSaveSuccess()
                dismiss()

                // Show success dialog with credentials!
                showCredentialsDialog(hostActivity, businessName, email, instapayHandle, generatedPassword)
            } else {
                binding.btnSave.isEnabled = true
                binding.btnSave.text = getString(R.string.btn_save_merchant)
                val error = response.errorMessage ?: "Failed to create merchant"
                Toast.makeText(requireContext(), error, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showCredentialsDialog(activity: android.app.Activity, name: String, email: String, handle: String, tempPass: String) {
        val dialogView = android.widget.LinearLayout(activity).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            val padding = (24 * resources.displayMetrics.density).toInt()
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(android.graphics.Color.parseColor("#121212"))
        }

        val title = android.widget.TextView(activity).apply {
            text = "Merchant Account Created!"
            textSize = 18f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 0, 0, (12 * resources.displayMetrics.density).toInt())
        }
        dialogView.addView(title)

        val info = android.widget.TextView(activity).apply {
            text = "Copy the details below and share them with the merchant so they can log in to their account."
            textSize = 13f
            setTextColor(android.graphics.Color.parseColor("#aaaaaa"))
            setPadding(0, 0, 0, (16 * resources.displayMetrics.density).toInt())
        }
        dialogView.addView(info)

        // Email block
        val emailLabel = android.widget.TextView(activity).apply {
            text = "Email Address"
            textSize = 11f
            setTextColor(android.graphics.Color.GRAY)
        }
        dialogView.addView(emailLabel)

        val emailValue = android.widget.TextView(activity).apply {
            text = email
            textSize = 14f
            setTextColor(android.graphics.Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, (12 * resources.displayMetrics.density).toInt())
        }
        dialogView.addView(emailValue)

        // Handle block
        val handleLabel = android.widget.TextView(activity).apply {
            text = "InstaPay Handle"
            textSize = 11f
            setTextColor(android.graphics.Color.GRAY)
        }
        dialogView.addView(handleLabel)

        val handleValue = android.widget.TextView(activity).apply {
            text = handle
            textSize = 14f
            setTextColor(android.graphics.Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, (12 * resources.displayMetrics.density).toInt())
        }
        dialogView.addView(handleValue)

        // Password block
        val passLabel = android.widget.TextView(activity).apply {
            text = "Generated Password"
            textSize = 11f
            setTextColor(android.graphics.Color.GRAY)
        }
        dialogView.addView(passLabel)

        val passValue = android.widget.TextView(activity).apply {
            text = tempPass
            textSize = 16f
            setTextColor(activity.getColor(R.color.brand_primary))
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, (20 * resources.displayMetrics.density).toInt())
        }
        dialogView.addView(passValue)

        // Copy button
        val copyButton = android.widget.Button(activity).apply {
            text = "Copy Credentials Text"
            setOnClickListener {
                val clipData = "Business: $name\nEmail: $email\nHandle: $handle\nPassword: $tempPass"
                val clipboard = activity.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("InstaPay Credentials", clipData))
                Toast.makeText(activity, "Credentials copied to clipboard!", Toast.LENGTH_SHORT).show()
            }
        }
        dialogView.addView(copyButton)

        androidx.appcompat.app.AlertDialog.Builder(activity)
            .setView(dialogView)
            .setPositiveButton("Close", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
