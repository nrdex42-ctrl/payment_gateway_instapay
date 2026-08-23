package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.instapaydetector.admin.databinding.FragmentAdminLogListBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

abstract class AdminLogListFragment : Fragment() {
    protected abstract val titleText: String
    protected abstract val subtitleText: String
    protected abstract val emptyText: String
    protected abstract val endpoint: String
    protected abstract val arrayKey: String
    protected abstract fun mapItem(item: JSONObject): AdminLogEntry

    private var _binding: FragmentAdminLogListBinding? = null
    private val binding get() = _binding!!
    private val items = mutableListOf<AdminLogEntry>()
    private lateinit var adapter: AdminLogEntryAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAdminLogListBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.tvTitle.text = titleText
        binding.tvSubtitle.text = subtitleText
        binding.tvEmpty.text = emptyText
        adapter = AdminLogEntryAdapter(items)
        binding.rvLogs.layoutManager = LinearLayoutManager(requireContext())
        binding.rvLogs.adapter = adapter
        binding.swipeRefresh.setOnRefreshListener { loadData() }
        binding.swipeRefresh.isRefreshing = true
        loadData()
    }

    private fun loadData() {
        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), endpoint)
            binding.swipeRefresh.isRefreshing = false
            if (response.isUnauthorized) return@launch handleUnauthorized()
            items.clear()
            if (response.isSuccessful && response.json != null) {
                val array = response.json.optJSONArray(arrayKey) ?: JSONArray()
                for (i in 0 until array.length()) items.add(mapItem(array.getJSONObject(i)))
            }
            adapter.notifyDataSetChanged()
            binding.tvEmpty.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
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
