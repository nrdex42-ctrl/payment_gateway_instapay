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

        // Load saved config
        binding.gatewayUrlInput.setText(config.gatewayUrl)
        binding.authTokenInput.setText(config.authToken)
        binding.merchantHandleInput.setText(config.merchantHandle)
        binding.myHandleInput.setText(config.myHandle)

        // Mode toggle
        when (config.detectorMode) {
            DetectorMode.MERCHANT -> binding.modeToggleGroup.check(R.id.merchantModeButton)
            DetectorMode.CLIENT -> binding.modeToggleGroup.check(R.id.clientModeButton)
        }
        refreshModeDependentFields()

        binding.modeToggleGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            config.detectorMode = when (checkedId) {
                R.id.clientModeButton -> DetectorMode.CLIENT
                else -> DetectorMode.MERCHANT
            }
            refreshModeDependentFields()
        }

        binding.saveButton.setOnClickListener {
            val url = binding.gatewayUrlInput.text.toString().trim()
            val token = binding.authTokenInput.text.toString().trim()
            val merchantHandle = binding.merchantHandleInput.text.toString().trim()
            val myHandle = binding.myHandleInput.text.toString().trim()

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
            config.myHandle = myHandle
            Toast.makeText(requireContext(), "Saved", Toast.LENGTH_SHORT).show()
        }

        binding.grantPermissionButton.setOnClickListener { openNotificationAccessSettings() }
        binding.testButton.setOnClickListener { sendTestNotification() }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionStatus()
    }

    private fun refreshModeDependentFields() {
        val isClient = config.detectorMode == DetectorMode.CLIENT
        binding.myHandleInputLayout.visibility = if (isClient) View.VISIBLE else View.GONE
        binding.monitoredHandleLabel.text = if (isClient) {
            "Reporting payments sent by: ${binding.myHandleInput.text}"
        } else {
            "Reporting payments received by: ${binding.merchantHandleInput.text}"
        }
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
            when (config.detectorMode) {
                DetectorMode.MERCHANT -> "Merchant mode · listening for received payments"
                DetectorMode.CLIENT -> "Client mode · listening for sent payments"
            }
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
        val fakeSender = when (config.detectorMode) {
            DetectorMode.MERCHANT -> "testuser@instapay"
            DetectorMode.CLIENT -> config.myHandle.ifBlank { "myhandle@instapay" }
        }
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
