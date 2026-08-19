package com.instapaydetector.admin

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.admin.databinding.FragmentSettingsBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

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

        displayStaticInfo()
        setupListeners()
        loadSettings()
    }

    private fun displayStaticInfo() {
        val context = requireContext()
        binding.tvGatewayUrl.text = ApiClient.getGatewayUrl(context)
        binding.tvPortalHash.text = ApiClient.getPortalHash(context)

        try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            binding.tvVersion.text = packageInfo.versionName
        } catch (e: Exception) {
            binding.tvVersion.text = "1.0.0"
        }
    }

    private fun setupListeners() {
        // DST Mode selection listener
        binding.chipGroupDst.setOnCheckedStateChangeListener { _, checkedIds ->
            val newMode = when (checkedIds.firstOrNull()) {
                R.id.chip_dst_summer -> "SUMMER"
                R.id.chip_dst_winter -> "WINTER"
                else -> "AUTO"
            }
            updateDstMode(newMode)
        }

        // Logout listener
        binding.btnLogout.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setMessage(R.string.confirm_logout)
                .setNegativeButton(R.string.btn_cancel, null)
                .setPositiveButton(R.string.btn_logout) { _, _ ->
                    logout()
                }
                .show()
        }
    }

    private fun loadSettings() {
        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), "/api/settings")
            if (response.isSuccessful && response.json != null) {
                val json = response.json
                val dstMode = json.optString("dstMode", "AUTO")
                val currentEgyptTime = json.optString("currentEgyptTime", "")

                binding.tvEgyptTime.text = currentEgyptTime

                // Disable listener temporarily to prevent cycle
                binding.chipGroupDst.setOnCheckedStateChangeListener(null)
                when (dstMode) {
                    "SUMMER" -> binding.chipGroupDst.check(R.id.chip_dst_summer)
                    "WINTER" -> binding.chipGroupDst.check(R.id.chip_dst_winter)
                    else -> binding.chipGroupDst.check(R.id.chip_dst_auto)
                }
                setupListeners() // Restore listeners
            } else if (response.isUnauthorized) {
                handleUnauthorized()
            }
        }
    }

    private fun updateDstMode(newMode: String) {
        lifecycleScope.launch {
            val body = JSONObject().apply {
                put("dstMode", newMode)
            }
            val response = ApiClient.post(requireContext(), "/api/settings", body)
            if (response.isSuccessful && response.json != null) {
                val json = response.json
                binding.tvEgyptTime.text = json.optString("currentEgyptTime", "")
                Toast.makeText(requireContext(), "DST Mode updated successfully", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(requireContext(), response.errorMessage ?: "Failed to update DST Mode", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun logout() {
        ApiClient.clearPrefs(requireContext())
        startActivity(Intent(requireActivity(), SetupActivity::class.java))
        requireActivity().finish()
    }

    private fun handleUnauthorized() {
        ApiClient.clearPrefs(requireContext())
        startActivity(Intent(requireActivity(), SetupActivity::class.java))
        requireActivity().finish()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
