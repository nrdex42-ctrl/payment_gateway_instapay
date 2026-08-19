package com.instapaydetector.admin

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.instapaydetector.admin.databinding.ItemPendingApprovalBinding
import org.json.JSONObject

class PendingApprovalAdapter(
    private var items: List<JSONObject>,
    private val onApprove: (id: String) -> Unit,
    private val onReject: (id: String) -> Unit
) : RecyclerView.Adapter<PendingApprovalAdapter.ViewHolder>() {

    fun updateItems(newItems: List<JSONObject>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemPendingApprovalBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.bind(item)
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemPendingApprovalBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: JSONObject) {
            val id = item.optString("id")
            val businessName = item.optString("businessName")
            val instapayHandle = item.optString("instapayHandle")
            val email = item.optString("email")

            binding.tvBusinessName.text = businessName
            binding.tvHandle.text = instapayHandle
            binding.tvEmail.text = email

            binding.btnApprove.setOnClickListener {
                onApprove(id)
            }
            binding.btnReject.setOnClickListener {
                onReject(id)
            }
        }
    }
}
