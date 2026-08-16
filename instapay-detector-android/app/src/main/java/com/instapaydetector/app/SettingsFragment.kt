package com.instapaydetector.app

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import com.instapaydetector.app.databinding.FragmentSettingsBinding
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import java.util.Date

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    private lateinit var config: GatewayConfig

    private val notificationAccessLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { refreshPermissionStatus() }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        config = GatewayConfig.get(requireContext())

        // Hide mode toggle card since APK is always client-specific received mode now
        binding.modeToggleGroup.visibility = View.GONE
        // Hide the description and label next to it
        binding.modeToggleGroup.parent?.let { parentView ->
            if (parentView is View) {
                parentView.visibility = View.GONE
            }
        }

        // Load saved config
        binding.gatewayUrlInput.setText(config.gatewayUrl)
        binding.authTokenInput.setText(config.authToken)
        binding.merchantHandleInput.setText(config.merchantHandle)
        
        // Always hide myHandle input since CLIENT mode is removed
        binding.myHandleInputLayout.visibility = View.GONE

        binding.saveButton.setOnClickListener {
            val url = binding.gatewayUrlInput.text.toString().trim()
            val token = binding.authTokenInput.text.toString().trim()
            val merchantHandle = binding.merchantHandleInput.text.toString().trim()

            if (url.isEmpty()) {
                Toast.makeText(requireContext(), "Please enter the gateway URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (token.isEmpty()) {
                Toast.makeText(requireContext(), "Please enter the auth token", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            config.gatewayUrl = url
            config.authToken = token
            config.merchantHandle = merchantHandle
            
            binding.monitoredHandleLabel.text = "Reporting payments received by: $merchantHandle"
            Toast.makeText(requireContext(), "Config Saved", Toast.LENGTH_SHORT).show()
        }

        binding.monitoredHandleLabel.text = "Reporting payments received by: ${config.merchantHandle}"
        binding.grantPermissionButton.setOnClickListener { openNotificationAccessSettings() }
        binding.testButton.setOnClickListener { sendTestNotification() }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionStatus()
    }

    private fun refreshPermissionStatus() {
        val granted = InstaPayNotificationListener.isPermissionGranted(requireContext())
        binding.permissionStatusText.text = if (granted) {
            getString(R.string.permission_status_granted)
        } else {
            getString(R.string.permission_status_denied)
        }
        binding.permissionStatusText.setTextColor(
            resources.getColor(
                if (granted) R.color.status_confirmed else R.color.status_denied,
                null
            )
        )
        binding.listenerStatusText.text = if (granted) {
            "Active · listening for received payments"
        } else {
            getString(R.string.listener_idle)
        }

        val lastDetection = requireContext()
            .getSharedPreferences(DETECTIONS_PREFS, android.content.Context.MODE_PRIVATE)
            .getString(KEY_LAST_DETECTION, null)
        binding.lastDetectionText.text = lastDetection ?: getString(R.string.last_detection_none)
    }

    private fun openNotificationAccessSettings() {
        try {
            notificationAccessLauncher.launch(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        } catch (e: Exception) {
            Toast.makeText(requireContext(), "Cannot open notification settings: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun sendTestNotification() {
        val url = config.gatewayUrl
        val token = config.authToken
        if (url.isEmpty() || token.isEmpty()) {
            Toast.makeText(requireContext(), "Save the gateway URL and token first", Toast.LENGTH_LONG).show()
            return
        }

        val fakeAmount = 1.00
        val fakeSender = "testuser@instapay"
        val fakeRecipient = config.merchantHandle

        val lastDetection = "TEST: $fakeAmount EGP from $fakeSender → $fakeRecipient (sent to webhook)"
        requireContext()
            .getSharedPreferences(DETECTIONS_PREFS, android.content.Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_DETECTION, lastDetection)
            .apply()

        MainScope().launch {
            val client = GatewayClient(requireContext())
            val ok = client.reportPayment(
                amountEgp = fakeAmount,
                senderHandle = fakeSender,
                recipientHandle = fakeRecipient,
                reference = "TEST-${System.currentTimeMillis() / 1000}",
                notificationTimestampIso = Date().toInstant().toString()
            )
            Toast.makeText(
                requireContext(),
                if (ok) "Test webhook sent — check dashboard" else "Webhook POST failed — check URL/token",
                Toast.LENGTH_LONG
            ).show()
            refreshPermissionStatus()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val DETECTIONS_PREFS = "instapay_detections"
        private const val KEY_LAST_DETECTION = "last_detection"
    }
}
