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
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.formatter.ValueFormatter
import com.instapaydetector.app.databinding.FragmentDashboardBinding
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    private val apiClient by lazy { (activity as MainActivity).apiClient }
    private val config by lazy { GatewayConfig.get(requireContext()) }
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
        renderLocalProfileFallback()

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
        binding.profileName.text = dash.merchant.name
        binding.profileHandle.text = dash.merchant.handle
        binding.profileEmail.text = dash.merchant.email.ifBlank { config.merchantEmail.ifBlank { "Email unavailable" } }
        binding.profileGateway.text = gatewayBaseUrl()
        binding.profileMode.text = "Merchant detector · ${dash.subscription?.plan?.replace("_", " ") ?: config.subscriptionPlan.replace("_", " ")}"

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

        // Subscription Info Card
        val sub = dash.subscription
        if (sub != null) {
            binding.cardSubscription.visibility = View.VISIBLE
            val planLabel = sub.plan.replace("_", " ")
            binding.tvPlanName.text = if (sub.isFreeTrial) "FREE TRIAL" else planLabel
            binding.profilePlan.text = if (sub.isFreeTrial) "Free trial" else planLabel
            binding.profileDuration.text = formatSubscriptionDuration(sub.subscriptionEndsAt)
            binding.tvTxUsage.text = "${sub.txCount} / ${sub.txLimit} confirmed transactions used"
            config.subscriptionPlan = sub.plan
            config.subscriptionEndsAt = sub.subscriptionEndsAt

            // Progress bar
            val pct = if (sub.txLimit > 0) (sub.txCount * 100) / sub.txLimit else 0
            binding.progressTx.progress = Math.min(pct, 100)

            // Remaining days
            if (sub.subscriptionEndsAt != null) {
                try {
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                    val endDate = sdf.parse(sub.subscriptionEndsAt)
                    if (endDate != null) {
                        val remainMs = endDate.time - System.currentTimeMillis()
                        val remainDays = (remainMs / (1000L * 60 * 60 * 24)).toInt()
                        if (remainDays > 0) {
                            binding.tvPlanExpiry.text = "Expires in $remainDays day${if (remainDays != 1) "s" else ""}"
                            binding.tvPlanExpiry.setTextColor(resources.getColor(R.color.text_secondary, null))
                        } else {
                            binding.tvPlanExpiry.text = "EXPIRED"
                            binding.tvPlanExpiry.setTextColor(resources.getColor(R.color.status_denied, null))
                        }
                    }
                } catch (e: Exception) {
                    binding.tvPlanExpiry.text = "No expiry"
                }
            } else {
                binding.tvPlanExpiry.text = "No expiry"
            }

            // Limit warning
            if (sub.txCount >= sub.txLimit) {
                binding.tvLimitWarning.visibility = View.VISIBLE
                binding.tvLimitWarning.text = "⚠ Limit reached. Contact your provider to upgrade."
            } else {
                binding.tvLimitWarning.visibility = View.GONE
            }
        } else {
            binding.cardSubscription.visibility = View.GONE
            binding.profilePlan.text = config.subscriptionPlan.replace("_", " ")
            binding.profileDuration.text = formatSubscriptionDuration(config.subscriptionEndsAt)
        }

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
            Entry(i.toFloat(), point.totalEgp.toFloat())
        }

        if (entries.isEmpty()) {
            binding.chart.visibility = View.GONE
            binding.chartEmpty.visibility = View.VISIBLE
            return
        }

        binding.chart.visibility = View.VISIBLE
        binding.chartEmpty.visibility = View.GONE

        val dataSet = LineDataSet(entries, "Revenue (EGP)").apply {
            color = resources.getColor(R.color.brand_primary, null)
            setDrawValues(false)
            setDrawCircles(true)
            setCircleColor(resources.getColor(R.color.brand_primary, null))
            circleRadius = 3.5f
            setDrawCircleHole(false)
            lineWidth = 2.5f
            mode = LineDataSet.Mode.CUBIC_BEZIER
            setDrawFilled(true)
            fillDrawable = resources.getDrawable(R.drawable.bg_chart_gradient, null)
            highLightColor = resources.getColor(R.color.brand_secondary, null)
        }

        val lineData = LineData(dataSet)

        binding.chart.apply {
            data = lineData
            description.isEnabled = false
            legend.isEnabled = false
            setDrawGridBackground(false)
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

    private fun renderLocalProfileFallback() {
        binding.merchantName.text = "Merchant account"
        binding.merchantHandle.text = config.merchantHandle
        binding.profileName.text = config.merchantHandle.substringBefore('@').replaceFirstChar { it.uppercaseChar() }
        binding.profileHandle.text = config.merchantHandle
        binding.profileEmail.text = config.merchantEmail.ifBlank { "Email unavailable" }
        binding.profileGateway.text = gatewayBaseUrl()
        binding.profilePlan.text = config.subscriptionPlan.replace("_", " ")
        binding.profileDuration.text = formatSubscriptionDuration(config.subscriptionEndsAt)
        binding.profileMode.text = "Merchant detector · ${config.subscriptionPlan.replace("_", " ")}"
    }

    private fun gatewayBaseUrl(): String {
        val url = config.gatewayUrl
        return if (url.contains("/api/webhooks/instapay")) {
            url.substring(0, url.indexOf("/api/webhooks/instapay"))
        } else {
            url.trimEnd('/')
        }
    }

    private fun formatSubscriptionDuration(value: String?): String {
        if (value.isNullOrBlank()) return "No expiry date"
        return try {
            val normalized = value.replace(Regex("\\.\\d{3}Z$"), "Z")
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val endDate = sdf.parse(normalized) ?: return "No expiry date"
            val remainMs = endDate.time - System.currentTimeMillis()
            val remainDays = kotlin.math.ceil(remainMs / (1000.0 * 60 * 60 * 24)).toInt()
            when {
                remainDays > 1 -> "$remainDays days remaining"
                remainDays == 1 -> "1 day remaining"
                else -> "Expired"
            }
        } catch (_: Exception) {
            "No expiry date"
        }
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
