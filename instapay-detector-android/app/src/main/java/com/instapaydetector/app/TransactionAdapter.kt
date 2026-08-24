package com.instapaydetector.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.instapaydetector.app.databinding.ItemTransactionBinding
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.Date
import java.util.TimeZone

/**
 * RecyclerView adapter for transaction rows. Uses ListAdapter + DiffUtil
 * for efficient updates (only re-renders rows that actually changed).
 */
class TransactionAdapter :
    ListAdapter<Transaction, TransactionAdapter.TxVH>(DIFF) {

    var onItemClick: ((Transaction) -> Unit)? = null

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TxVH {
        val binding = ItemTransactionBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return TxVH(binding)
    }

    override fun onBindViewHolder(holder: TxVH, position: Int) {
        holder.bind(getItem(position))
    }

    inner class TxVH(private val binding: ItemTransactionBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(tx: Transaction) {
            val ctx = binding.root.context

            // Sender handle
            binding.senderHandle.text = tx.senderHandle

            // First letter avatar
            val firstChar = tx.senderHandle.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
            binding.avatarInitial.text = firstChar

            // Amount with sign based on status
            val amountText = when (tx.status) {
                "CONFIRMED" -> "+${formatAmount(tx.amountEgp)} ${tx.currency}"
                "PENDING" -> "~${formatAmount(tx.amountEgp)} ${tx.currency}"
                "EXPIRED" -> "${formatAmount(tx.amountEgp)} ${tx.currency}"
                else -> "${formatAmount(tx.amountEgp)} ${tx.currency}"
            }
            binding.amount.text = amountText

            // Color + avatar background based on status
            val (amountColor, avatarBg, avatarTextColor) = when (tx.status) {
                "CONFIRMED" -> Triple(
                    ctx.resources.getColor(R.color.status_confirmed, null),
                    ctx.resources.getColor(R.color.status_confirmed_bg, null),
                    ctx.resources.getColor(R.color.status_confirmed, null)
                )
                "PENDING" -> Triple(
                    ctx.resources.getColor(R.color.status_pending, null),
                    ctx.resources.getColor(R.color.status_pending_bg, null),
                    ctx.resources.getColor(R.color.status_pending, null)
                )
                "EXPIRED" -> Triple(
                    ctx.resources.getColor(R.color.status_expired, null),
                    ctx.resources.getColor(R.color.status_expired_bg, null),
                    ctx.resources.getColor(R.color.status_expired, null)
                )
                else -> Triple(
                    ctx.resources.getColor(R.color.text_primary, null),
                    ctx.resources.getColor(R.color.status_expired_bg, null),
                    ctx.resources.getColor(R.color.text_secondary, null)
                )
            }
            binding.amount.setTextColor(amountColor)
            binding.avatarInitial.setTextColor(avatarTextColor)
            binding.avatarBg.setBackgroundResource(
                when (tx.status) {
                    "CONFIRMED" -> R.drawable.bg_avatar_confirmed
                    "PENDING" -> R.drawable.bg_avatar_pending
                    "EXPIRED" -> R.drawable.bg_avatar_expired
                    else -> R.drawable.bg_avatar_expired
                }
            )

            // Reference or fallback to sessionId prefix
            binding.reference.text = tx.detectedRef ?: tx.sessionId.take(12)

            // Timestamp
            val iso = tx.detectedAt ?: tx.createdAt
            binding.timestamp.text = formatRelative(iso)

            // Click handler
            binding.root.setOnClickListener { onItemClick?.invoke(tx) }
        }

        private fun formatAmount(amount: Double): String {
            return String.format(Locale.US, "%,.2f", amount)
        }

        private fun formatRelative(iso: String): String {
            return try {
                val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val then = parser.parse(iso) ?: Date()
                val diffMs = Date().time - then.time
                val diffSec = diffMs / 1000
                when {
                    diffSec < 0 -> "just now"
                    diffSec < 60 -> "just now"
                    diffSec < 3600 -> "${diffSec / 60}m ago"
                    diffSec < 86400 -> "${diffSec / 3600}h ago"
                    diffSec < 604800 -> "${diffSec / 86400}d ago"
                    else -> {
                        val output = SimpleDateFormat("MMM d", Locale.US).apply {
                            timeZone = TimezoneManager.getTimeZone(binding.root.context)
                        }
                        output.format(then)
                    }
                }
            } catch (_: Exception) {
                try {
                    val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                    val then = parser.parse(iso) ?: Date()
                    val diffMs = Date().time - then.time
                    val diffSec = diffMs / 1000
                    when {
                        diffSec < 0 -> "just now"
                        diffSec < 60 -> "just now"
                        diffSec < 3600 -> "${diffSec / 60}m ago"
                        diffSec < 86400 -> "${diffSec / 3600}h ago"
                        diffSec < 604800 -> "${diffSec / 86400}d ago"
                        else -> {
                            val output = SimpleDateFormat("MMM d", Locale.US).apply {
                                timeZone = TimezoneManager.getTimeZone(binding.root.context)
                            }
                            output.format(then)
                        }
                    }
                } catch (_: Exception) {
                    ""
                }
            }
        }
    }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Transaction>() {
            override fun areItemsTheSame(old: Transaction, new: Transaction) =
                old.sessionId == new.sessionId

            override fun areContentsTheSame(old: Transaction, new: Transaction) = old == new
        }
    }
}
