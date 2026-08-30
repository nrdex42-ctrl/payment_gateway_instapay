package com.instapaydetector.app

import android.content.Context
import android.text.format.DateUtils
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.instapaydetector.app.databinding.ItemNotificationHistoryBinding

class NotificationHistoryAdapter(
    private val onItemClick: (HistoryNotification) -> Unit
) : RecyclerView.Adapter<NotificationHistoryAdapter.ViewHolder>() {

    private var items: List<HistoryNotification> = emptyList()

    fun submitList(newItems: List<HistoryNotification>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemNotificationHistoryBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemNotificationHistoryBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: HistoryNotification) {
            val ctx = binding.root.context
            binding.tvTitle.text = item.title
            binding.tvBody.text = item.body
            binding.unreadDot.visibility = if (item.isRead) View.GONE else View.VISIBLE

            val timeAgo = DateUtils.getRelativeTimeSpanString(
                item.timestamp,
                System.currentTimeMillis(),
                DateUtils.MINUTE_IN_MILLIS
            )
            binding.tvTime.text = timeAgo

            when (item.type.uppercase()) {
                "PAYMENT" -> {
                    binding.tvTypeTag.text = "Payment"
                    binding.tvTypeTag.setTextColor(ContextCompat.getColor(ctx, R.color.live_green))
                    binding.iconContainer.setBackgroundResource(R.drawable.bg_status_confirmed)
                    binding.ivIcon.setImageResource(R.drawable.ic_ipn_notification)
                    binding.ivIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.status_confirmed))
                }
                "SYSTEM" -> {
                    binding.tvTypeTag.text = "System"
                    binding.tvTypeTag.setTextColor(ContextCompat.getColor(ctx, R.color.brand_secondary))
                    binding.iconContainer.setBackgroundResource(R.drawable.bg_status_pending)
                    binding.ivIcon.setImageResource(R.drawable.ic_settings)
                    binding.ivIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.brand_secondary))
                }
                "WARNING" -> {
                    binding.tvTypeTag.text = "Warning"
                    binding.tvTypeTag.setTextColor(ContextCompat.getColor(ctx, R.color.status_pending))
                    binding.iconContainer.setBackgroundResource(R.drawable.bg_status_pending)
                    binding.ivIcon.setImageResource(R.drawable.ic_settings)
                    binding.ivIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.status_pending))
                }
                else -> {
                    binding.tvTypeTag.text = "Alert"
                    binding.tvTypeTag.setTextColor(ContextCompat.getColor(ctx, R.color.brand_primary))
                    binding.iconContainer.setBackgroundResource(R.drawable.bg_status_confirmed)
                    binding.ivIcon.setImageResource(R.drawable.ic_ipn_notification)
                    binding.ivIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.brand_primary))
                }
            }

            binding.root.setOnClickListener {
                onItemClick(item)
            }
        }
    }
}
