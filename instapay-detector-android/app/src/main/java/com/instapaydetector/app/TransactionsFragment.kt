package com.instapaydetector.app

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.instapaydetector.app.databinding.FragmentTransactionsBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class TransactionsFragment : Fragment() {

    private var _binding: FragmentTransactionsBinding? = null
    private val binding get() = _binding!!

    private val apiClient by lazy { (activity as MainActivity).apiClient }

    private lateinit var adapter: TransactionAdapter
    private val allTransactions = mutableListOf<Transaction>()
    private var currentCursor: String? = null
    private var isLoadingMore = false

    private var currentQuery: String = ""
    private var currentStatus: String? = null

    private var searchJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTransactionsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = TransactionAdapter()
        adapter.onItemClick = { tx -> showDetail(tx) }
        binding.list.layoutManager = LinearLayoutManager(requireContext())
        binding.list.adapter = adapter

        // Swipe to refresh
        binding.swipeRefresh.setOnRefreshListener { loadFirstPage() }

        // Search with debounce
        binding.searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun afterTextChanged(s: Editable?) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchJob?.cancel()
                searchJob = viewLifecycleOwner.lifecycleScope.launch {
                    delay(400) // debounce
                    currentQuery = s?.toString()?.trim() ?: ""
                    loadFirstPage()
                }
            }
        })

        // Filter chips
        binding.filterGroup.setOnCheckedStateChangeListener { _, checkedIds ->
            val status = when (checkedIds.firstOrNull()) {
                R.id.filterConfirmed -> "CONFIRMED"
                R.id.filterPending -> "PENDING"
                R.id.filterExpired -> "EXPIRED"
                else -> null
            }
            setStatusFilter(status)
        }

        // Export button
        binding.exportButton.setOnClickListener {
            CsvExporter.export(requireContext(), allTransactions)
        }

        // Pagination: load more when scrolled to bottom
        binding.list.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(rv: RecyclerView, dx: Int, dy: Int) {
                val lm = rv.layoutManager as LinearLayoutManager
                val visible = lm.childCount
                val total = lm.itemCount
                val first = lm.findFirstVisibleItemPosition()
                if (!isLoadingMore && currentCursor != null && total - visible <= first + 5) {
                    loadNextPage()
                }
            }
        })

        loadFirstPage()
    }

    private fun setStatusFilter(status: String?) {
        currentStatus = status
        loadFirstPage()
    }

    private fun loadFirstPage() {
        binding.swipeRefresh.isRefreshing = true
        currentCursor = null
        allTransactions.clear()
        adapter.submitList(emptyList())

        viewLifecycleOwner.lifecycleScope.launch {
            val result = apiClient.fetchTransactions(
                query = currentQuery.ifBlank { null },
                status = currentStatus,
                limit = 50,
                cursor = null
            )
            binding.swipeRefresh.isRefreshing = false

            result.onSuccess { list ->
                allTransactions.addAll(list.transactions)
                adapter.submitList(allTransactions.toList())
                currentCursor = list.pagination.nextCursor
                updateEmptyState()
            }.onFailure { e ->
                binding.errorText.visibility = View.VISIBLE
                binding.errorText.text = "Failed to load: ${e.message}"
            }
        }
    }

    private fun loadNextPage() {
        if (currentCursor == null) return
        isLoadingMore = true
        binding.loadMoreProgress.visibility = View.VISIBLE

        viewLifecycleOwner.lifecycleScope.launch {
            val result = apiClient.fetchTransactions(
                query = currentQuery.ifBlank { null },
                status = currentStatus,
                limit = 50,
                cursor = currentCursor
            )
            isLoadingMore = false
            binding.loadMoreProgress.visibility = View.GONE

            result.onSuccess { list ->
                allTransactions.addAll(list.transactions)
                adapter.submitList(allTransactions.toList())
                currentCursor = list.pagination.nextCursor
                updateEmptyState()
            }.onFailure {
                // Silently fail — user can pull to refresh to retry
            }
        }
    }

    private fun updateEmptyState() {
        binding.errorText.visibility = View.GONE
        if (allTransactions.isEmpty()) {
            binding.emptyState.visibility = View.VISIBLE
            binding.exportButton.isEnabled = false
        } else {
            binding.emptyState.visibility = View.GONE
            binding.exportButton.isEnabled = true
        }
    }

    private fun showDetail(tx: Transaction) {
        val dialog = TransactionDetailDialog.newInstance(tx)
        dialog.show(parentFragmentManager, "tx_detail")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
