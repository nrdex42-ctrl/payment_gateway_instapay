package com.instapaydetector.admin

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.instapaydetector.admin.databinding.ItemOpsEntryBinding

data class AdminLogEntry(
    val title: String,
    val subtitle: String,
    val meta: String,
    val badge: String,
    val tone: AdminLogTone
)

enum class AdminLogTone { SUCCESS, ERROR, NEUTRAL }

class AdminLogEntryAdapter(
    private val items: List<AdminLogEntry>
) : RecyclerView.Adapter<AdminLogEntryAdapter.VH>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemOpsEntryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    class VH(private val binding: ItemOpsEntryBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: AdminLogEntry) {
            binding.tvTitle.text = item.title
            binding.tvSubtitle.text = item.subtitle
            binding.tvMeta.text = item.meta
            binding.tvBadge.text = item.badge
            val context = binding.root.context
            when (item.tone) {
                AdminLogTone.SUCCESS -> {
                    binding.tvBadge.setTextColor(context.getColor(R.color.status_confirmed))
                    binding.tvBadge.setBackgroundColor(context.getColor(R.color.status_confirmed_bg))
                }
                AdminLogTone.ERROR -> {
                    binding.tvBadge.setTextColor(context.getColor(R.color.status_denied))
                    binding.tvBadge.setBackgroundColor(context.getColor(R.color.status_denied_bg))
                }
                AdminLogTone.NEUTRAL -> {
                    binding.tvBadge.setTextColor(context.getColor(R.color.text_secondary))
                    binding.tvBadge.setBackgroundColor(context.getColor(R.color.bg_input))
                }
            }
        }
    }
}
