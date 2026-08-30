package com.instapaydetector.app

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.instapaydetector.app.databinding.DialogNotificationHistoryBinding

class NotificationHistoryBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogNotificationHistoryBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: NotificationHistoryAdapter
    private var currentFilter: String = "ALL"
    var onDismissCallback: (() -> Unit)? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogNotificationHistoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val mgr = NotificationHistoryManager.get(requireContext())

        adapter = NotificationHistoryAdapter { item ->
            mgr.markRead(item.id)
            loadList()
        }

        binding.rvNotifications.layoutManager = LinearLayoutManager(requireContext())
        binding.rvNotifications.adapter = adapter

        binding.filterToggleGroup.check(R.id.btnFilterAll)
        binding.filterToggleGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (isChecked) {
                currentFilter = when (checkedId) {
                    R.id.btnFilterPayments -> "PAYMENT"
                    R.id.btnFilterSystem -> "SYSTEM"
                    else -> "ALL"
                }
                loadList()
            }
        }

        binding.btnMarkAllRead.setOnClickListener {
            mgr.markAllRead()
            loadList()
        }

        binding.btnClearAll.setOnClickListener {
            mgr.clear()
            loadList()
        }

        loadList()
    }

    private fun loadList() {
        val mgr = NotificationHistoryManager.get(requireContext())
        val all = mgr.getHistory()
        val filtered = when (currentFilter) {
            "PAYMENT" -> all.filter { it.type.equals("PAYMENT", ignoreCase = true) }
            "SYSTEM" -> all.filter { it.type.equals("SYSTEM", ignoreCase = true) || it.type.equals("WARNING", ignoreCase = true) }
            else -> all
        }

        if (filtered.isEmpty()) {
            binding.rvNotifications.visibility = View.GONE
            binding.tvEmptyHistory.visibility = View.VISIBLE
        } else {
            binding.rvNotifications.visibility = View.VISIBLE
            binding.tvEmptyHistory.visibility = View.GONE
            adapter.submitList(filtered)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        onDismissCallback?.invoke()
        _binding = null
    }

    companion object {
        const val TAG = "NotifHistorySheet"

        fun newInstance(): NotificationHistoryBottomSheet = NotificationHistoryBottomSheet()
    }
}
