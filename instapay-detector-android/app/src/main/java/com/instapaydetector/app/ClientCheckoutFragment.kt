package com.instapaydetector.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.app.databinding.FragmentClientCheckoutBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class ClientCheckoutFragment : Fragment() {

    private var _binding: FragmentClientCheckoutBinding? = null
    private val binding get() = _binding!!

    private val httpClient = OkHttpClient()
    private var currentSessionId: String? = null
    private var currentDeepLinkUrl: String? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentClientCheckoutBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnGenerateCheckout.setOnClickListener {
            generateCheckout()
        }

        binding.btnOpenInstapay.setOnClickListener {
            currentDeepLinkUrl?.let { url ->
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    Toast.makeText(requireContext(), "InstaPay app not installed or invalid URL", Toast.LENGTH_SHORT).show()
                }
            }
        }

        binding.btnSimulatePayment.setOnClickListener {
            simulatePayment()
        }
    }

    private fun generateCheckout() {
        val sender = binding.etSenderHandle.text.toString().trim()
        val amountStr = binding.etAmount.text.toString().trim()
        val note = binding.etNote.text.toString().trim()

        if (sender.isEmpty()) {
            binding.etSenderHandle.error = "Enter customer handle"
            return
        }
        val amount = amountStr.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            binding.etAmount.error = "Enter valid amount"
            return
        }

        val config = GatewayConfig.get(requireContext())
        var baseUrl = config.gatewayUrl.removeSuffix("/api/webhooks/instapay").removeSuffix("/")
        if (baseUrl.isEmpty() || baseUrl.startsWith("https://your-gateway.example.com")) {
            baseUrl = "http://localhost:3000"
        }

        binding.btnGenerateCheckout.isEnabled = false

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val payload = JSONObject().apply {
                    put("amountEgp", amount)
                    put("senderHandle", sender)
                    if (note.isNotEmpty()) put("note", note)
                }

                val request = Request.Builder()
                    .url("$baseUrl/api/v1/checkout/create")
                    .post(payload.toString().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = httpClient.newCall(request).execute()
                val bodyStr = response.body?.string().orEmpty()

                withContext(Dispatchers.Main) {
                    binding.btnGenerateCheckout.isEnabled = true
                    if (response.isSuccessful) {
                        val json = JSONObject(bodyStr)
                        val checkout = json.getJSONObject("checkout")
                        currentSessionId = checkout.getString("sessionId")
                        currentDeepLinkUrl = checkout.getString("deepLinkUrl")

                        binding.cardResult.isVisible = true
                        binding.tvAmountDisplay.text = String.format("%.2f EGP", amount)
                        binding.tvSessionDisplay.text = "Session: $currentSessionId"
                        binding.tvStatusBadge.text = "⏳ Waiting for payment..."
                        binding.tvStatusBadge.setBackgroundColor(0xFFFEF3C7.toInt())
                        binding.tvStatusBadge.setTextColor(0xD97706.toInt())

                        Toast.makeText(requireContext(), "Payment link created successfully!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(requireContext(), "Error creating checkout: ${response.code}", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.btnGenerateCheckout.isEnabled = true
                    Toast.makeText(requireContext(), "Connection failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun simulatePayment() {
        val sessionId = currentSessionId ?: run {
            Toast.makeText(requireContext(), "Create a checkout first", Toast.LENGTH_SHORT).show()
            return
        }

        binding.tvStatusBadge.text = "🎉 Payment Confirmed!"
        binding.tvStatusBadge.setBackgroundColor(0xFFD1FAE5.toInt())
        binding.tvStatusBadge.setTextColor(0xFF047857.toInt())

        (activity as? MainActivity)?.paymentFeedback?.celebrate()
        Toast.makeText(requireContext(), "Payment status flipped to CONFIRMED!", Toast.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
