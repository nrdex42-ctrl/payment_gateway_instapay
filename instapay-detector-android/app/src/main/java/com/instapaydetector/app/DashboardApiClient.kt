package com.instapaydetector.app

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Gateway API client for the merchant dashboard app.
 *
 * Endpoints used:
 *   GET  /api/dashboard          — stats + recent transactions
 *   GET  /api/stats/chart?days=N — daily revenue series for the chart
 *   GET  /api/transactions?q=&status=&limit=&cursor= — paginated list
 *
 * The base URL is derived from the configured webhook URL by stripping
 * the trailing /api/webhooks/instapay path. The auth token is sent as
 * a Bearer header on every request (the gateway accepts it for all
 * endpoints — unauthenticated GET is also allowed, but we send the token
 * anyway so the merchant can see private data).
 */
class DashboardApiClient(private val ctx: Context) {

    private val config = GatewayConfig.get(ctx)
    private val cachePrefs = ctx.getSharedPreferences("dashboard_cache", Context.MODE_PRIVATE)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    /** Derives the gateway base URL from the configured webhook URL. */
    private val baseUrl: String by lazy {
        val url = config.gatewayUrl
        // Strip /api/webhooks/instapay if present
        if (url.contains("/api/webhooks/instapay")) {
            url.substring(0, url.indexOf("/api/webhooks/instapay"))
        } else {
            // Fallback: strip the last path segment
            url.trimEnd('/').substringBeforeLast('/')
        }
    }

    suspend fun fetchDashboard(): Result<DashboardStats> = withContext(Dispatchers.IO) {
        try {
            val res = get("$baseUrl/api/dashboard")
            if (!res.isSuccessful) {
                loadCachedDashboard()?.let { return@withContext Result.success(it) }
                return@withContext Result.failure(Exception("HTTP ${res.code}"))
            }
            val json = JSONObject(res.body)
            cachePrefs.edit()
                .putString(KEY_DASHBOARD_JSON, res.body)
                .putLong(KEY_DASHBOARD_CACHED_AT, System.currentTimeMillis())
                .apply()
            Result.success(parseDashboard(json))
        } catch (e: Exception) {
            Log.e(TAG, "fetchDashboard failed: ${e.message}", e)
            loadCachedDashboard()?.let { return@withContext Result.success(it) }
            Result.failure(e)
        }
    }

    suspend fun fetchChart(days: Int = 30): Result<ChartData> = withContext(Dispatchers.IO) {
        try {
            val res = get("$baseUrl/api/stats/chart?days=$days")
            if (!res.isSuccessful) {
                return@withContext Result.failure(Exception("HTTP ${res.code}"))
            }
            val json = JSONObject(res.body)
            Result.success(parseChart(json))
        } catch (e: Exception) {
            Log.e(TAG, "fetchChart failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    suspend fun fetchTransactions(
        query: String? = null,
        status: String? = null,
        limit: Int = 50,
        cursor: String? = null
    ): Result<TransactionList> = withContext(Dispatchers.IO) {
        try {
            val params = mutableListOf<String>()
            if (!query.isNullOrBlank()) params.add("q=${java.net.URLEncoder.encode(query, "UTF-8")}")
            if (!status.isNullOrBlank()) params.add("status=$status")
            params.add("limit=$limit")
            if (!cursor.isNullOrBlank()) params.add("cursor=${java.net.URLEncoder.encode(cursor, "UTF-8")}")
            val url = "$baseUrl/api/transactions?" + params.joinToString("&")

            val res = get(url)
            if (!res.isSuccessful) {
                return@withContext Result.failure(Exception("HTTP ${res.code}"))
            }
            val json = JSONObject(res.body)
            Result.success(parseTransactionList(json))
        } catch (e: Exception) {
            Log.e(TAG, "fetchTransactions failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    private fun get(url: String): HttpResponse {
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer ${config.authToken}")
            .addHeader("Accept", "application/json")
            .get()
            .build()

        httpClient.newCall(request).execute().use { response ->
            return HttpResponse(response.code, response.body?.string().orEmpty())
        }
    }

    // --- JSON parsers ---

    private fun loadCachedDashboard(): DashboardStats? {
        val cached = cachePrefs.getString(KEY_DASHBOARD_JSON, null) ?: return null
        return try {
            parseDashboard(JSONObject(cached))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse cached dashboard: ${e.message}", e)
            null
        }
    }

    private fun parseDashboard(json: JSONObject): DashboardStats {
        val merchant = json.getJSONObject("merchant")
        val stats = json.getJSONObject("stats")
        val recentArr = json.getJSONArray("recent")

        val subscription = if (json.has("subscription") && !json.isNull("subscription")) {
            val sub = json.getJSONObject("subscription")
            SubscriptionInfo(
                plan = sub.optString("plan", "FREE_TRIAL"),
                txCount = sub.optInt("txCount", 0),
                txLimit = sub.optInt("txLimit", 5),
                subscriptionEndsAt = if (sub.isNull("subscriptionEndsAt")) null else sub.optString("subscriptionEndsAt"),
                isFreeTrial = sub.optBoolean("isFreeTrial", true),
            )
        } else null

        return DashboardStats(
            merchant = MerchantInfo(
                handle = merchant.getString("handle"),
                name = merchant.getString("name"),
            ),
            stats = StatsBreakdown(
                today = parseBucket(stats.getJSONObject("today")),
                sevenDays = parseBucket(stats.getJSONObject("sevenDays")),
                pending = parseBucket(stats.getJSONObject("pending")),
            ),
            recent = parseTransactions(recentArr),
            subscription = subscription,
        )
    }

    private fun parseBucket(json: JSONObject): StatBucket {
        return StatBucket(
            count = json.getInt("count"),
            totalEgp = json.getDouble("totalEgp"),
        )
    }

    private fun parseChart(json: JSONObject): ChartData {
        val range = json.getJSONObject("range")
        val seriesArr = json.getJSONArray("series")
        val summary = json.getJSONObject("summary")

        val series = mutableListOf<ChartPoint>()
        for (i in 0 until seriesArr.length()) {
            val p = seriesArr.getJSONObject(i)
            series.add(ChartPoint(
                date = p.getString("date"),
                totalEgp = p.getDouble("totalEgp"),
                count = p.getInt("count"),
            ))
        }

        val bestDay = summary.getJSONObject("bestDay")
        return ChartData(
            range = ChartRange(
                days = range.getInt("days"),
                startDate = range.getString("startDate"),
                endDate = range.getString("endDate"),
            ),
            series = series,
            summary = ChartSummary(
                totalRevenue = summary.getDouble("totalRevenue"),
                totalCount = summary.getInt("totalCount"),
                avgPerDay = summary.getDouble("avgPerDay"),
                bestDay = ChartBestDay(
                    date = bestDay.getString("date"),
                    totalEgp = bestDay.getDouble("totalEgp"),
                    count = bestDay.getInt("count"),
                ),
            ),
        )
    }

    private fun parseTransactionList(json: JSONObject): TransactionList {
        val arr = json.getJSONArray("transactions")
        val pagination = json.getJSONObject("pagination")
        return TransactionList(
            transactions = parseTransactions(arr),
            pagination = Pagination(
                limit = pagination.getInt("limit"),
                hasMore = pagination.getBoolean("hasMore"),
                nextCursor = if (pagination.isNull("nextCursor")) null else pagination.getString("nextCursor"),
                count = pagination.getInt("count"),
            ),
        )
    }

    private fun parseTransactions(arr: JSONArray): List<Transaction> {
        val list = mutableListOf<Transaction>()
        for (i in 0 until arr.length()) {
            val t = arr.getJSONObject(i)
            list.add(Transaction(
                sessionId = t.getString("sessionId"),
                senderHandle = t.getString("senderHandle"),
                recipientHandle = t.getString("recipientHandle"),
                amountEgp = t.getDouble("amountEgp"),
                currency = t.getString("currency"),
                status = t.getString("status"),
                note = if (t.isNull("note")) null else t.getString("note"),
                deepLinkUrl = if (t.isNull("deepLinkUrl")) null else t.getString("deepLinkUrl"),
                deepLinkToken = if (t.isNull("deepLinkToken")) null else t.getString("deepLinkToken"),
                detectedRef = if (t.isNull("detectedRef")) null else t.getString("detectedRef"),
                detectedAt = if (t.isNull("detectedAt")) null else t.getString("detectedAt"),
                createdAt = t.getString("createdAt"),
                expiresAt = t.getString("expiresAt"),
            ))
        }
        return list
    }

    private data class HttpResponse(val code: Int, val body: String) {
        val isSuccessful: Boolean get() = code in 200..299
    }

    companion object {
        private const val TAG = "DashboardApi"
        private const val KEY_DASHBOARD_JSON = "dashboard_json"
        private const val KEY_DASHBOARD_CACHED_AT = "dashboard_cached_at"
    }
}
