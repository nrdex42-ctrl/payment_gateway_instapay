package com.instapaydetector.admin

/**
 * Portal-parity tab.
 *
 * Billing controls currently live in SettingsFragment's plan manager section.
 * Keeping a dedicated fragment class lets the APK navigation match the admin website
 * while preserving the existing tested plan-management implementation.
 */
class BillingFragment : SettingsFragment()
