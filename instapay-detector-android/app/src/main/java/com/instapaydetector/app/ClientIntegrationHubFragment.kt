package com.instapaydetector.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.instapaydetector.app.databinding.FragmentClientIntegrationHubBinding

class ClientIntegrationHubFragment : Fragment() {

    private var _binding: FragmentClientIntegrationHubBinding? = null
    private val binding get() = _binding!!

    private var currentSnippet = ""

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentClientIntegrationHubBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val config = GatewayConfig.get(requireContext())
        binding.tvTokenDisplay.text = config.authToken

        var baseUrl = config.gatewayUrl.removeSuffix("/api/webhooks/instapay").removeSuffix("/")
        if (baseUrl.isEmpty() || baseUrl.startsWith("https://your-gateway.example.com")) {
            baseUrl = "https://your-gateway.example.com"
        }
        binding.tvApiEndpointDisplay.text = "POST $baseUrl/api/v1/checkout/create"

        val snippets = mapOf(
            "curl" to """curl -X POST $baseUrl/api/v1/checkout/create \
  -H "Content-Type: application/json" \
  -d '{
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1004"
  }'""",
            "js" to """const response = await fetch('$baseUrl/api/v1/checkout/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amountEgp: 50.00,
    senderHandle: 'customer@instapay',
    note: 'Order #1004'
  })
});
const data = await response.json();
console.log('Payment Deep Link:', data.checkout.deepLinkUrl);""",
            "python" to """import requests

url = "$baseUrl/api/v1/checkout/create"
payload = {
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1004"
}
res = requests.post(url, json=payload).json()
print("Deep Link:", res["checkout"]["deepLinkUrl"])""",
            "php" to """<?php
${'$'}ch = curl_init("$baseUrl/api/v1/checkout/create");
curl_setopt(${'$'}ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt(${'$'}ch, CURLOPT_POST, true);
curl_setopt(${'$'}ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt(${'$'}ch, CURLOPT_POSTFIELDS, json_encode([
    'amountEgp' => 50.00,
    'senderHandle' => 'customer@instapay',
    'note' => 'Order #1004'
]));
${'$'}res = json_decode(curl_exec(${'$'}ch), true);
echo "Status: " . ${'$'}res['checkout']['status'];
?>"""
        )

        fun selectLanguage(lang: String) {
            currentSnippet = snippets[lang] ?: ""
            binding.tvSnippetCode.text = currentSnippet
        }

        binding.btnSnippetCurl.setOnClickListener { selectLanguage("curl") }
        binding.btnSnippetJs.setOnClickListener { selectLanguage("js") }
        binding.btnSnippetPython.setOnClickListener { selectLanguage("python") }
        binding.btnSnippetPhp.setOnClickListener { selectLanguage("php") }

        selectLanguage("curl")

        binding.btnCopySnippet.setOnClickListener {
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Integration Code Snippet", currentSnippet)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(requireContext(), "Snippet copied to clipboard!", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
