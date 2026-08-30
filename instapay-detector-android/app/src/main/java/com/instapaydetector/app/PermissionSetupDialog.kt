package com.instapaydetector.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.FragmentManager
import com.google.android.material.button.MaterialButton

class PermissionSetupDialog : DialogFragment() {

    private val postNotificationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        refreshPermissionStates()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NO_TITLE, android.R.style.Theme_Material_Light_Dialog_MinWidth)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return inflater.inflate(R.layout.dialog_permissions_setup, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val btnGrantListener = view.findViewById<MaterialButton>(R.id.btnGrantListener)
        val btnGrantPost = view.findViewById<MaterialButton>(R.id.btnGrantPostNotifications)
        val btnGrantBattery = view.findViewById<MaterialButton>(R.id.btnGrantBattery)
        val btnDone = view.findViewById<MaterialButton>(R.id.btnDone)

        btnGrantListener.setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            } catch (_: Exception) {
                try {
                    startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"))
                } catch (_: Exception) {}
            }
        }

        btnGrantPost.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                postNotificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        btnGrantBattery.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${requireContext().packageName}")
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                    try {
                        startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                    } catch (_: Exception) {}
                }
            }
        }

        btnDone.setOnClickListener {
            dismiss()
        }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionStates()
    }

    private fun refreshPermissionStates() {
        val view = view ?: return
        val ctx = context ?: return

        // 1. Notification Listener Access
        val isListenerGranted = isNotificationListenerGranted(ctx)
        val btnGrantListener = view.findViewById<MaterialButton>(R.id.btnGrantListener)
        val txtListenerGranted = view.findViewById<TextView>(R.id.txtListenerGranted)

        if (isListenerGranted) {
            btnGrantListener.visibility = View.GONE
            txtListenerGranted.visibility = View.VISIBLE
        } else {
            btnGrantListener.visibility = View.VISIBLE
            txtListenerGranted.visibility = View.GONE
        }

        // 2. Post Notifications
        val layoutPost = view.findViewById<View>(R.id.layoutPostNotifications)
        val btnGrantPost = view.findViewById<MaterialButton>(R.id.btnGrantPostNotifications)
        val txtPostGranted = view.findViewById<TextView>(R.id.txtPostNotificationsGranted)

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            layoutPost.visibility = View.GONE
        } else {
            val isPostGranted = ContextCompat.checkSelfPermission(
                ctx,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            if (isPostGranted) {
                btnGrantPost.visibility = View.GONE
                txtPostGranted.visibility = View.VISIBLE
            } else {
                btnGrantPost.visibility = View.VISIBLE
                txtPostGranted.visibility = View.GONE
            }
        }

        // 3. Battery Optimization
        val btnGrantBattery = view.findViewById<MaterialButton>(R.id.btnGrantBattery)
        val txtBatteryGranted = view.findViewById<TextView>(R.id.txtBatteryGranted)
        val isBatteryIgnored = isBatteryOptimizationIgnored(ctx)

        if (isBatteryIgnored) {
            btnGrantBattery.visibility = View.GONE
            txtBatteryGranted.visibility = View.VISIBLE
        } else {
            btnGrantBattery.visibility = View.VISIBLE
            txtBatteryGranted.visibility = View.GONE
        }
    }

    companion object {
        private const val TAG = "PermissionSetupDialog"

        fun isNotificationListenerGranted(context: Context): Boolean {
            return NotificationManagerCompat.getEnabledListenerPackages(context)
                .contains(context.packageName)
        }

        fun isBatteryOptimizationIgnored(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                pm?.isIgnoringBatteryOptimizations(context.packageName) == true
            } else {
                true
            }
        }

        fun isPostNotificationsGranted(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
        }

        fun hasAllPermissions(context: Context): Boolean {
            return isNotificationListenerGranted(context) &&
                   isBatteryOptimizationIgnored(context) &&
                   isPostNotificationsGranted(context)
        }

        fun showIfNeeded(fragmentManager: FragmentManager, context: Context) {
            if (!hasAllPermissions(context)) {
                if (fragmentManager.findFragmentByTag(TAG) == null) {
                    PermissionSetupDialog().show(fragmentManager, TAG)
                }
            }
        }
    }
}
