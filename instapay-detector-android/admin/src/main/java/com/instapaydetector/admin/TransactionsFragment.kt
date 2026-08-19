package com.instapaydetector.admin

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.instapaydetector.admin.databinding.FragmentTransactionsBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

class TransactionsFragment : Fragment() {

    private var _binding: FragmentTransactionsBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: TransactionAdapter
    private val transactionsList = mutableListOf<JSONObject>()

    private var searchQuery = ""
    private var statusFilter = "" // Empty represents ALL, else PENDING, CONFIRMED, EXPIRED

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

        setupRecyclerView()
        setupListeners()

        binding.swipeRefresh.setOnRefreshListener {
            loadTransactions()
        }

        binding.btnExport.setOnClickListener {
            exportTransactions()
        }

        binding.swipeRefresh.isRefreshing = true
        loadTransactions()
    }

    private fun setupRecyclerView() {
        adapter = TransactionAdapter(transactionsList) { sessionId ->
            showForceConfirmDialog(sessionId)
        }
        binding.rvTransactions.layoutManager = LinearLayoutManager(requireContext())
        binding.rvTransactions.adapter = adapter
    }

    private fun setupListeners() {
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchQuery = s?.toString()?.trim() ?: ""
                loadTransactions()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.chipGroupStatus.setOnCheckedStateChangeListener { _, checkedIds ->
            statusFilter = when (checkedIds.firstOrNull()) {
                R.id.chip_pending -> "PENDING"
                R.id.chip_confirmed -> "CONFIRMED"
                R.id.chip_expired -> "EXPIRED"
                else -> ""
            }
            loadTransactions()
        }
    }

    private fun loadTransactions() {
        lifecycleScope.launch {
            val encodedQuery = URLEncoder.encode(searchQuery, "UTF-8")
            var path = "/api/transactions?q=$encodedQuery&status=$statusFilter"
            val clientId = arguments?.getString("clientId")
            if (!clientId.isNullOrEmpty()) {
                path += "&clientId=$clientId"
            }
            val response = ApiClient.get(requireContext(), path)
            binding.swipeRefresh.isRefreshing = false
            if (response.isSuccessful && response.json != null) {
                val array = response.json.optJSONArray("transactions") ?: JSONArray()
                transactionsList.clear()
                for (i in 0 until array.length()) {
                    transactionsList.add(array.getJSONObject(i))
                }
                adapter.notifyDataSetChanged()
                binding.tvEmpty.visibility = if (transactionsList.isEmpty()) View.VISIBLE else View.GONE
            } else if (response.isUnauthorized) {
                handleUnauthorized()
            } else {
                Toast.makeText(requireContext(), response.errorMessage ?: "Failed to load transactions", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showForceConfirmDialog(sessionId: String) {
        AlertDialog.Builder(requireContext())
            .setMessage(R.string.confirm_force_confirm)
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_force_confirm) { _, _ ->
                lifecycleScope.launch {
                    binding.swipeRefresh.isRefreshing = true
                    val response = ApiClient.post(requireContext(), "/api/admin/transactions/$sessionId/confirm", JSONObject())
                    if (response.isSuccessful) {
                        Toast.makeText(requireContext(), getString(R.string.toast_confirmed), Toast.LENGTH_SHORT).show()
                        loadTransactions()
                    } else {
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(requireContext(), response.errorMessage ?: "Failed to confirm", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .show()
    }

    private fun exportTransactions() {
        val gatewayUrl = ApiClient.getGatewayUrl(requireContext())
        val secret = ApiClient.getOwnerSecret(requireContext())
        if (gatewayUrl.isEmpty() || secret.isEmpty()) return

        val encodedQuery = URLEncoder.encode(searchQuery, "UTF-8")
        var exportUrl = "$gatewayUrl/api/transactions/export?q=$encodedQuery&status=$statusFilter"
        val clientId = arguments?.getString("clientId")
        if (!clientId.isNullOrEmpty()) {
            exportUrl += "&clientId=$clientId"
        }

        try {
            val request = DownloadManager.Request(Uri.parse(exportUrl))
                .addRequestHeader("Authorization", "Bearer $secret")
                .setTitle("InstaPay Transactions CSV")
                .setDescription("Downloading transactions list...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "transactions_${System.currentTimeMillis()}.csv")

            val manager = requireContext().getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            manager.enqueue(request)
            Toast.makeText(requireContext(), "Download started. Check notifications.", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(requireContext(), getString(R.string.toast_export_failed) + ": ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun handleUnauthorized() {
        ApiClient.clearPrefs(requireContext())
        startActivity(android.content.Intent(requireActivity(), SetupActivity::class.java))
        requireActivity().finish()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
