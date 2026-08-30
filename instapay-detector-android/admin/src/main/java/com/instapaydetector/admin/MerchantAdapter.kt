package com.instapaydetector.admin

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import com.instapaydetector.admin.databinding.ItemMerchantCardBinding
import org.json.JSONObject

class MerchantAdapter(
    private val context: Context,
    private var items: List<JSONObject>,
    private val onToggleActive: (id: String, currentActive: Boolean) -> Unit,
    private val onDelete: (id: String) -> Unit,
    private val onEditSubscription: ((id: String) -> Unit)? = null,
    private val onViewTransactions: ((id: String, businessName: String) -> Unit)? = null
) : RecyclerView.Adapter<MerchantAdapter.ViewHolder>() {

    // Set of merchant IDs whose details are expanded
    private val expandedIds = mutableSetOf<String>()

    fun updateItems(newItems: List<JSONObject>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemMerchantCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.bind(item)
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemMerchantCardBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: JSONObject) {
            val id = item.optString("id")
            val businessName = item.optString("businessName")
            val slug = item.optString("slug")
            val instapayHandle = item.optString("instapayHandle")
            val email = item.optString("email")
            val apiKey = item.optString("apiKey", "")
            val detectToken = item.optString("detectToken", "")
            val isActive = item.optBoolean("isActive", true)
            val approvalStatus = item.optString("approvalStatus", "APPROVED")
            val confirmedVolume = item.optDouble("confirmedVolume", 0.0)
            val totalTransactions = item.optInt("totalTransactions", 0)
            val subscriptionPlan = item.optString("subscriptionPlan", "TRIAL")
            val isFreeTrial = item.optBoolean("isFreeTrial", true)
            val subscriptionEndsAt = item.optString("subscriptionEndsAt", "")

            binding.tvBusinessName.text = businessName
            binding.tvSlug.text = "/$slug"
            binding.tvHandle.text = instapayHandle
            binding.tvEmail.text = email
            binding.tvRevenue.text = String.format("%.2f", confirmedVolume)
            binding.tvTxCount.text = context.getString(R.string.label_transactions_count, totalTransactions)

            // Status styling
            when (approvalStatus) {
                "APPROVED" -> {
                    binding.tvStatus.text = if (isActive) "ACTIVE" else "DISABLED"
                    binding.tvStatus.setTextColor(context.getColor(if (isActive) R.color.status_confirmed else R.color.status_expired))
                    binding.tvStatus.setBackgroundColor(context.getColor(if (isActive) R.color.status_confirmed_bg else R.color.status_expired_bg))
                }
                "PENDING" -> {
                    binding.tvStatus.text = "PENDING"
                    binding.tvStatus.setTextColor(context.getColor(R.color.status_pending))
                    binding.tvStatus.setBackgroundColor(context.getColor(R.color.status_pending_bg))
                }
                else -> {
                    binding.tvStatus.text = "REJECTED"
                    binding.tvStatus.setTextColor(context.getColor(R.color.status_denied))
                    binding.tvStatus.setBackgroundColor(context.getColor(R.color.status_denied_bg))
                }
            }

            // Subscription rendering & Quota
            val txLimit = item.optInt("txLimit", 5)
            val txCount = item.optInt("txCount", 0)
            val quotaPercent = if (txLimit > 0) ((txCount.toDouble() / txLimit) * 100).toInt().coerceIn(0, 100) else 0

            binding.tvSubscription.text = (if (isFreeTrial) "TRIAL" else subscriptionPlan.uppercase())
            binding.tvSubscription.setTextColor(context.getColor(if (isFreeTrial) R.color.status_pending else R.color.status_confirmed))
            binding.tvSubscription.setBackgroundColor(context.getColor(if (isFreeTrial) R.color.status_pending_bg else R.color.status_confirmed_bg))

            binding.tvQuotaLabel.text = "$txCount / $txLimit tx ($quotaPercent%)"
            binding.pbQuota.progress = quotaPercent
            if (quotaPercent >= 100) {
                binding.pbQuota.progressTintList = android.content.res.ColorStateList.valueOf(context.getColor(R.color.status_denied))
            } else if (quotaPercent >= 80) {
                binding.pbQuota.progressTintList = android.content.res.ColorStateList.valueOf(context.getColor(R.color.status_pending))
            } else {
                binding.pbQuota.progressTintList = android.content.res.ColorStateList.valueOf(context.getColor(R.color.brand_primary))
            }

            var isExpired = false
            var daysRemaining: Long? = null
            if (subscriptionEndsAt.isNotEmpty() && subscriptionEndsAt != "null") {
                try {
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                    val date = sdf.parse(subscriptionEndsAt)
                    if (date != null) {
                        val displayFormat = java.text.SimpleDateFormat("MMM dd, yyyy", java.util.Locale.US)
                        binding.tvSubscriptionEnds.text = displayFormat.format(date)
                        val diffMillis = date.time - System.currentTimeMillis()
                        daysRemaining = diffMillis / (1000 * 60 * 60 * 24)
                        if (diffMillis < 0) {
                            isExpired = true
                        }
                    } else {
                        binding.tvSubscriptionEnds.text = "Lifetime"
                    }
                } catch (e: Exception) {
                    binding.tvSubscriptionEnds.text = "Lifetime"
                }
            } else {
                binding.tvSubscriptionEnds.text = "Lifetime"
            }

            if (daysRemaining != null) {
                binding.tvDaysRemaining.visibility = View.VISIBLE
                if (daysRemaining < 0) {
                    binding.tvDaysRemaining.text = "Expired"
                    binding.tvDaysRemaining.setTextColor(context.getColor(R.color.status_denied))
                    binding.tvDaysRemaining.setBackgroundColor(context.getColor(R.color.status_denied_bg))
                } else if (daysRemaining == 0L) {
                    binding.tvDaysRemaining.text = "Expires today"
                    binding.tvDaysRemaining.setTextColor(context.getColor(R.color.status_pending))
                    binding.tvDaysRemaining.setBackgroundColor(context.getColor(R.color.status_pending_bg))
                } else {
                    binding.tvDaysRemaining.text = "${daysRemaining}d left"
                    binding.tvDaysRemaining.setTextColor(context.getColor(if (daysRemaining <= 3) R.color.status_pending else R.color.status_confirmed))
                    binding.tvDaysRemaining.setBackgroundColor(context.getColor(if (daysRemaining <= 3) R.color.status_pending_bg else R.color.status_confirmed_bg))
                }
            } else {
                binding.tvDaysRemaining.visibility = View.GONE
            }

            if (isExpired || txCount >= txLimit) {
                binding.tvSubscription.text = if (txCount >= txLimit) "QUOTA FULL" else "EXPIRED"
                binding.tvSubscription.setTextColor(context.getColor(R.color.status_denied))
                binding.tvSubscription.setBackgroundColor(context.getColor(R.color.status_denied_bg))
                binding.tvSubscriptionEnds.setTextColor(context.getColor(R.color.status_denied))
            } else {
                binding.tvSubscriptionEnds.setTextColor(context.getColor(R.color.text_secondary))
            }

            binding.btnEditSubscription.setOnClickListener {
                onEditSubscription?.invoke(id)
            }

            binding.btnViewTransactions.setOnClickListener {
                onViewTransactions?.invoke(id, businessName)
            }

            // Expanded logic for keys
            val isExpanded = expandedIds.contains(id)
            if (isExpanded && apiKey.isNotEmpty()) {
                binding.keysSection.visibility = View.VISIBLE
                binding.tvApiKey.text = apiKey
                binding.tvDetectToken.text = detectToken
            } else {
                binding.keysSection.visibility = View.GONE
            }

            binding.root.setOnClickListener {
                if (isExpanded) {
                    expandedIds.remove(id)
                } else {
                    expandedIds.add(id)
                }
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) notifyItemChanged(position)
            }

            // Copy operations
            binding.btnCopyApi.setOnClickListener {
                copyToClipboard("InstaPay API Key", apiKey)
            }

            binding.btnCopyToken.setOnClickListener {
                copyToClipboard("InstaPay APK Token", detectToken)
            }

            // Active/Inactive state toggle button representation
            binding.btnToggle.setImageResource(if (isActive) R.drawable.ic_check_circle else R.drawable.ic_x_circle)
            binding.btnToggle.setColorFilter(context.getColor(if (isActive) R.color.status_confirmed else R.color.status_expired))
            binding.btnToggle.setOnClickListener {
                onToggleActive(id, isActive)
            }

            // Delete operation
            binding.btnDelete.setOnClickListener {
                onDelete(id)
            }
        }

        private fun copyToClipboard(label: String, text: String) {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText(label, text)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(context, context.getString(R.string.toast_copied), Toast.LENGTH_SHORT).show()
        }
    }
}
