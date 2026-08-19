package com.instapaydetector.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate

class InstaPayApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Apply saved Theme Mode on application startup
        val prefs = getSharedPreferences("instapay_settings", MODE_PRIVATE)
        val savedTheme = prefs.getString("pref_theme", "system") ?: "system"
        val nightMode = when (savedTheme) {
            "light" -> AppCompatDelegate.MODE_NIGHT_NO
            "dark" -> AppCompatDelegate.MODE_NIGHT_YES
            else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
        }
        AppCompatDelegate.setDefaultNightMode(nightMode)

        // Apply saved Language on application startup
        LocaleHelper.applyLocale(this)
    }
}
