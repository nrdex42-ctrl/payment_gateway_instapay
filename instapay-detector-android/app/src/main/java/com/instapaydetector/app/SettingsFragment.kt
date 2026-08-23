package com.instapaydetector.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
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
        binding.gatewayUrlInput.isEnabled = false
        binding.authTokenInput.isEnabled = false
        binding.merchantHandleInput.isEnabled = false
        
        // Always hide myHandle input since CLIENT mode is removed
        binding.myHandleInputLayout.visibility = View.GONE
        updateSummaryHeader()
        loadDashboardSnapshot()
        binding.openDashboardButton.setOnClickListener {
            val dashboardUrl = "https://instapay-ruddy.vercel.app/dashboard"
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(dashboardUrl)))
        }
        binding.grantPermissionButton.setOnClickListener { openNotificationAccessSettings() }
        binding.testButton.setOnClickListener { sendTestNotification() }
        binding.logoutButton.setOnClickListener {
            config.isLoggedIn = false
            // Reset to defaults
            config.authToken = "instapay-sandbox-detector-token-2026"
            config.merchantHandle = "mohammedshabana77@instapay"
            config.dashboardApiKey = ""
            config.merchantEmail = ""
            config.subscriptionPlan = "FREE_TRIAL"
            config.subscriptionEndsAt = null
            
            val intent = Intent(requireContext(), LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
            activity?.finish()
        }

        binding.grantBatteryPermissionButton.setOnClickListener {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${requireContext().packageName}")
                    }
                    startActivity(intent)
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Failed to open settings: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionStatus()
        updateSummaryHeader()
        loadDashboardSnapshot()
    }

    private fun loadDashboardSnapshot() {
        MainScope().launch {
            val stats = try {
                DashboardApiClient(requireContext()).fetchDashboard().getOrNull()
            } catch (_: Exception) {
                null
            }
            if (!isAdded || _binding == null) return@launch
            if (stats != null) {
                binding.summaryPlanText.text = stats.subscription?.plan?.replace("_", " ") ?: config.subscriptionPlan.replace("_", " ")
                val sub = stats.subscription
                val quotaText = if (sub != null) {
                    "${sub.txCount}/${sub.txLimit} used"
                } else {
                    "Unavailable"
                }
                binding.summaryQuotaText.text = quotaText
                binding.summarySetupText.text = buildString {
                    append("Gateway settings are read-only here. ")
                    append(if (config.gatewayUrl.isBlank() || config.authToken.isBlank() || config.merchantHandle.isBlank()) "Complete the dashboard setup." else "Configuration synced from the web dashboard.")
                }
            } else {
                binding.summaryPlanText.text = config.subscriptionPlan.replace("_", " ")
                binding.summaryQuotaText.text = "Unavailable"
                binding.summarySetupText.text = "Open the web dashboard to manage profile, quota, and integration settings."
            }
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
            "Active · listening for received payments"
        } else {
            getString(R.string.listener_idle)
        }

        // Check battery optimizations status
        val pm = requireContext().getSystemService(Context.POWER_SERVICE) as PowerManager
        val isIgnoringBattery = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(requireContext().packageName)
        } else {
            true
        }

        if (isIgnoringBattery) {
            binding.batteryStatusText.text = "Battery Optimization: Unrestricted ✓"
            binding.batteryStatusText.setTextColor(resources.getColor(R.color.status_confirmed, null))
            binding.grantBatteryPermissionButton.visibility = View.GONE
        } else {
            binding.batteryStatusText.text = "Battery Optimization: Optimized (app may sleep) ✗"
            binding.batteryStatusText.setTextColor(resources.getColor(R.color.status_denied, null))
            binding.grantBatteryPermissionButton.visibility = View.VISIBLE
        }

        val lastDetection = requireContext()
            .getSharedPreferences(DETECTIONS_PREFS, android.content.Context.MODE_PRIVATE)
            .getString(KEY_LAST_DETECTION, null)
        binding.lastDetectionText.text = lastDetection ?: getString(R.string.last_detection_none)
    }

    private fun updateSummaryHeader() {
        binding.summaryMerchantName.text = config.merchantHandle.substringBefore('@').replaceFirstChar { it.uppercaseChar() }
        binding.summaryMerchantHandle.text = config.merchantHandle
        binding.summaryMerchantEmail.text = config.merchantEmail.ifBlank { "Email unavailable" }
        binding.summaryGatewayUrl.text = config.gatewayUrl.removeSuffix("/api/webhooks/instapay").trimEnd('/')
        binding.summaryDetectorMode.text = "Merchant detector"
        binding.summarySubscription.text = "${config.subscriptionPlan.replace("_", " ")} · ${formatSubscriptionDuration(config.subscriptionEndsAt)}"
        binding.summaryPlanText.text = config.subscriptionPlan.replace("_", " ")
        binding.summarySetupText.text = "Open the web dashboard to manage profile, quota, and integration settings."
        binding.summaryQuotaText.text = if (config.subscriptionEndsAt.isNullOrBlank()) "Unavailable" else "Subscription active"
        binding.monitoredHandleLabel.text = getString(R.string.monitored_handle_label, config.merchantHandle)
    }

    private fun formatSubscriptionDuration(value: String?): String {
        if (value.isNullOrBlank()) return "No expiry date"
        return try {
            val normalized = value.replace(Regex("\\.\\d{3}Z$"), "Z")
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
            sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val endDate = sdf.parse(normalized) ?: return "No expiry date"
            val remainMs = endDate.time - System.currentTimeMillis()
            val remainDays = kotlin.math.ceil(remainMs / (1000.0 * 60 * 60 * 24)).toInt()
            when {
                remainDays > 1 -> "$remainDays days remaining"
                remainDays == 1 -> "1 day remaining"
                else -> "Expired"
            }
        } catch (_: Exception) {
            "No expiry date"
        }
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
            val result = client.reportPayment(
                amountEgp = fakeAmount,
                senderHandle = fakeSender,
                recipientHandle = fakeRecipient,
                reference = "TEST-${System.currentTimeMillis() / 1000}",
                notificationTimestampIso = Date().toInstant().toString()
            )
            val toastMsg = when (result) {
                ReportResult.SUCCESS -> "Test webhook sent — check dashboard"
                ReportResult.SUBSCRIPTION_ENDED -> "Test failed — Trial/Subscription Ended"
                ReportResult.ERROR -> "Webhook POST failed — check URL/token"
            }
            Toast.makeText(
                requireContext(),
                toastMsg,
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
