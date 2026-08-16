package com.instapaydetector.app

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.BarData
import com.github.mikephil.charting.data.BarDataSet
import com.github.mikephil.charting.data.BarEntry
import com.github.mikephil.charting.formatter.ValueFormatter
import com.instapaydetector.app.databinding.FragmentDashboardBinding
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    private val apiClient by lazy { (activity as MainActivity).apiClient }
    private val paymentFeedback by lazy { (activity as MainActivity).paymentFeedback }
    private val wsClient by lazy { (activity as MainActivity).wsClient }

    private lateinit var recentAdapter: TransactionAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Set up recent transactions RecyclerView
        recentAdapter = TransactionAdapter()
        binding.recentList.layoutManager = LinearLayoutManager(requireContext())
        binding.recentList.adapter = recentAdapter

        // Configure swipe-to-refresh
        binding.swipeRefresh.setOnRefreshListener { loadAll() }

        // Wire up WebSocket for real-time updates
        wsClient.onConnectionChange = { connected ->
            requireActivity().runOnUiThread {
                binding.liveStatus.text = if (connected) getString(R.string.dash_live) else getString(R.string.dash_offline)
                binding.liveStatus.setTextColor(
                    if (connected) resources.getColor(R.color.live_green, null)
                    else resources.getColor(R.color.text_secondary, null)
                )
                binding.liveDot.visibility = if (connected) View.VISIBLE else View.GONE
            }
        }
        wsClient.onPaymentConfirmed = { event ->
            requireActivity().runOnUiThread {
                paymentFeedback.celebrate()
                loadAll()
            }
        }

        // "View all" button → switch to Transactions tab
        binding.viewAllButton.setOnClickListener {
            (activity as? MainActivity)?.let {
                it.findViewById<com.google.android.material.bottomnavigation.BottomNavigationView>(R.id.bottom_nav)
                    .selectedItemId = R.id.nav_transactions
            }
        }

        loadAll()
    }

    private fun loadAll() {
        binding.swipeRefresh.isRefreshing = true
        viewLifecycleOwner.lifecycleScope.launch {
            // Load dashboard stats + chart in parallel
            val dashResult = apiClient.fetchDashboard()
            val chartResult = apiClient.fetchChart(days = 30)

            binding.swipeRefresh.isRefreshing = false

            dashResult.onSuccess { dash -> renderDashboard(dash) }
                .onFailure { e ->
                    binding.errorText.visibility = View.VISIBLE
                    binding.errorText.text = "Failed to load: ${e.message}"
                }

            chartResult.onSuccess { chart -> renderChart(chart) }
                .onFailure {
                    // Chart failure is non-critical — just leave it empty
                }
        }
    }

    private fun renderDashboard(dash: DashboardStats) {
        binding.errorText.visibility = View.GONE
        binding.merchantName.text = dash.merchant.name
        binding.merchantHandle.text = dash.merchant.handle

        // Stat cards — each include layout has inner views accessible via the include's binding
        binding.cardToday.statLabel.text = getString(R.string.dash_today)
        binding.cardToday.statValue.text = formatEgp(dash.stats.today.totalEgp)
        binding.cardToday.statSub.text = "${dash.stats.today.count} ${pluralPayments(dash.stats.today.count)}"

        binding.card7days.statLabel.text = getString(R.string.dash_7days)
        binding.card7days.statValue.text = formatEgp(dash.stats.sevenDays.totalEgp)
        binding.card7days.statSub.text = "${dash.stats.sevenDays.count} ${pluralPayments(dash.stats.sevenDays.count)}"

        binding.cardPending.statLabel.text = getString(R.string.dash_pending)
        binding.cardPending.statValue.text = formatEgp(dash.stats.pending.totalEgp)
        binding.cardPending.statSub.text = "${dash.stats.pending.count} awaiting"

        binding.cardAvg.statLabel.text = getString(R.string.dash_avg)
        binding.cardAvg.statValue.text = formatEgp(dash.stats.sevenDays.totalEgp / 7.0)
        binding.cardAvg.statSub.text = "7-day average"

        // Recent transactions (show up to 5)
        if (dash.recent.isEmpty()) {
            binding.recentList.visibility = View.GONE
            binding.emptyState.visibility = View.VISIBLE
        } else {
            binding.recentList.visibility = View.VISIBLE
            binding.emptyState.visibility = View.GONE
            recentAdapter.submitList(dash.recent.take(5))
        }
    }

    private fun renderChart(chart: ChartData) {
        val entries = chart.series.mapIndexed { i, point ->
            BarEntry(i.toFloat(), point.totalEgp.toFloat())
        }

        if (entries.isEmpty()) {
            binding.chart.visibility = View.GONE
            binding.chartEmpty.visibility = View.VISIBLE
            return
        }

        binding.chart.visibility = View.VISIBLE
        binding.chartEmpty.visibility = View.GONE

        val dataSet = BarDataSet(entries, "Revenue (EGP)").apply {
            color = resources.getColor(R.color.brand_primary, null)
            setDrawValues(false)
            highLightColor = resources.getColor(R.color.brand_secondary, null)
        }

        val barData = BarData(dataSet).apply {
            barWidth = 0.7f
        }

        binding.chart.apply {
            data = barData
            description.isEnabled = false
            legend.isEnabled = false
            setDrawGridBackground(false)
            setFitBars(true)
            setTouchEnabled(true)
            setScaleEnabled(false)
            animateY(600)

            xAxis.apply {
                position = XAxis.XAxisPosition.BOTTOM
                setDrawGridLines(false)
                granularity = 1f
                labelCount = Math.min(chart.series.size, 6)
                textColor = resources.getColor(R.color.text_secondary, null)
                textSize = 9f
                valueFormatter = object : ValueFormatter() {
                    private val fmt = SimpleDateFormat("MMM d", Locale.US)
                    override fun getFormattedValue(value: Float): String {
                        val idx = value.toInt()
                        if (idx < 0 || idx >= chart.series.size) return ""
                        return chart.series[idx].date.let {
                            // Parse YYYY-MM-DD and format as "MMM d"
                            try {
                                val parts = it.split("-")
                                fmt.format(java.util.GregorianCalendar(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt()).time)
                            } catch (_: Exception) { it }
                        }
                    }
                }
            }

            axisLeft.apply {
                setDrawGridLines(true)
                gridColor = resources.getColor(R.color.chart_grid, null)
                textColor = resources.getColor(R.color.text_secondary, null)
                textSize = 9f
                axisMinimum = 0f
                valueFormatter = object : ValueFormatter() {
                    override fun getFormattedValue(value: Float): String {
                        return if (value >= 1000) "%.1fk".format(value / 1000) else "%.0f".format(value)
                    }
                }
            }

            axisRight.isEnabled = false
            invalidate()
        }

        // Render summary below chart
        binding.chartSummary.text =
            "Total ${formatEgp(chart.summary.totalRevenue)} • " +
            "${chart.summary.totalCount} payments • " +
            "Avg ${formatEgp(chart.summary.avgPerDay)}/day • " +
            "Best: ${chart.summary.bestDay.date} (${formatEgp(chart.summary.bestDay.totalEgp)})"
    }

    private fun formatEgp(amount: Double): String {
        return "EGP ${String.format(Locale.US, "%,.2f", amount)}"
    }

    private fun pluralPayments(count: Int): String =
        if (count == 1) getString(R.string.dash_payment) else getString(R.string.dash_payments)

    override fun onDestroyView() {
        super.onDestroyView()
        // Clear callbacks to avoid leaks
        wsClient.onConnectionChange = null
        wsClient.onPaymentConfirmed = null
        _binding = null
    }
}
