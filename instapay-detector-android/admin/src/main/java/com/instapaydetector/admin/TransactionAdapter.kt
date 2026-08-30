package com.instapaydetector.admin

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.instapaydetector.admin.databinding.ItemTransactionCardBinding
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class TransactionAdapter(
    private val items: List<JSONObject>,
    private val onForceConfirm: (sessionId: String) -> Unit
) : RecyclerView.Adapter<TransactionAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemTransactionCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.bind(item)
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemTransactionCardBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: JSONObject) {
            val sessionId = item.optString("sessionId")
            val amount = item.optDouble("amountEgp", 0.0)
            val status = item.optString("status", "PENDING").uppercase()
            val sender = item.optString("senderHandle", "")
            val recipient = item.optString("recipientHandle", "")
            val ref = item.optString("detectedRef", "")
            val createdAt = item.optString("createdAt", "")

            binding.tvAmount.text = String.format("%.2f", amount)
            binding.tvSender.text = if (sender.isEmpty()) "—" else sender
            binding.tvRecipient.text = if (recipient.isEmpty()) "—" else recipient
            binding.tvRef.text = if (ref.isEmpty()) "No Reference" else ref

            // Parse and format Date
            binding.tvDate.text = formatTimestamp(createdAt)

            // Status Styling
            val context = binding.root.context
            when (status) {
                "CONFIRMED" -> {
                    binding.tvStatusBadge.text = "CONFIRMED"
                    binding.tvStatusBadge.setTextColor(context.getColor(R.color.status_confirmed))
                    binding.tvStatusBadge.setBackgroundColor(context.getColor(R.color.status_confirmed_bg))
                    binding.btnForceConfirm.visibility = View.GONE
                }
                "PENDING" -> {
                    binding.tvStatusBadge.text = "PENDING"
                    binding.tvStatusBadge.setTextColor(context.getColor(R.color.status_pending))
                    binding.tvStatusBadge.setBackgroundColor(context.getColor(R.color.status_pending_bg))
                    binding.btnForceConfirm.visibility = View.VISIBLE
                    binding.btnForceConfirm.setOnClickListener {
                        onForceConfirm(sessionId)
                    }
                }
                "UNDERPAID" -> {
                    binding.tvStatusBadge.text = "UNDERPAID"
                    binding.tvStatusBadge.setTextColor(context.getColor(R.color.accent_amber))
                    binding.tvStatusBadge.setBackgroundColor(context.getColor(R.color.status_pending_bg))
                    binding.btnForceConfirm.visibility = View.VISIBLE
                    binding.btnForceConfirm.setOnClickListener {
                        onForceConfirm(sessionId)
                    }
                }
                "EXPIRED" -> {
                    binding.tvStatusBadge.text = "EXPIRED"
                    binding.tvStatusBadge.setTextColor(context.getColor(R.color.status_expired))
                    binding.tvStatusBadge.setBackgroundColor(context.getColor(R.color.status_expired_bg))
                    binding.btnForceConfirm.visibility = View.GONE
                }
                else -> {
                    binding.tvStatusBadge.text = status
                    binding.tvStatusBadge.setTextColor(context.getColor(R.color.status_denied))
                    binding.tvStatusBadge.setBackgroundColor(context.getColor(R.color.status_denied_bg))
                    binding.btnForceConfirm.visibility = View.GONE
                }
            }
        }

        private fun formatTimestamp(isoString: String): String {
            if (isoString.isEmpty()) return ""
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                inputFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputFormat.parse(isoString)
                if (date != null) {
                    val outputFormat = SimpleDateFormat("yyyy-MM-dd hh:mm a", Locale.getDefault())
                    outputFormat.format(date)
                } else {
                    isoString
                }
            } catch (e: Exception) {
                // fallback formats
                try {
                    val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
                    inputFormat.timeZone = TimeZone.getTimeZone("UTC")
                    val date = inputFormat.parse(isoString)
                    val outputFormat = SimpleDateFormat("yyyy-MM-dd hh:mm a", Locale.getDefault())
                    outputFormat.format(date!!)
                } catch (e2: Exception) {
                    isoString
                }
            }
        }
    }
}
