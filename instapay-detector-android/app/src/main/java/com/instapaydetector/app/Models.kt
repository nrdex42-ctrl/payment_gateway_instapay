package com.instapaydetector.app

/**
 * Data models for the merchant dashboard app.
 * These mirror the JSON shapes returned by the gateway's API endpoints.
 */

data class Transaction(
    val sessionId: String,
    val senderHandle: String,
    val recipientHandle: String,
    val amountEgp: Double,
    val currency: String,
    val status: String, // PENDING | CONFIRMED | EXPIRED
    val note: String?,
    val deepLinkUrl: String?,
    val deepLinkToken: String?,
    val detectedRef: String?,
    val detectedAt: String?,
    val createdAt: String,
    val expiresAt: String,
)

data class DashboardStats(
    val merchant: MerchantInfo,
    val stats: StatsBreakdown,
    val recent: List<Transaction>,
    val subscription: SubscriptionInfo?,
)

data class MerchantNotification(val id: String, val title: String, val message: String, val severity: String)

data class MerchantInfo(
    val handle: String,
    val name: String,
    val email: String,
    val webhookUrl: String? = null,
    val instapayPaymentUrl: String? = null,
    val checkoutTtlMin: Int? = null,
    val detectToken: String? = null,
    val apiKey: String? = null,
)

data class SubscriptionInfo(
    val plan: String,
    val txCount: Int,
    val txLimit: Int,
    val subscriptionEndsAt: String?,
    val isFreeTrial: Boolean,
)

data class StatsBreakdown(
    val today: StatBucket,
    val sevenDays: StatBucket,
    val pending: StatBucket,
)

data class StatBucket(
    val count: Int,
    val totalEgp: Double,
)

data class ChartData(
    val range: ChartRange,
    val series: List<ChartPoint>,
    val summary: ChartSummary,
)

data class ChartRange(
    val days: Int,
    val startDate: String,
    val endDate: String,
)

data class ChartPoint(
    val date: String, // YYYY-MM-DD
    val totalEgp: Double,
    val count: Int,
)

data class ChartSummary(
    val totalRevenue: Double,
    val totalCount: Int,
    val avgPerDay: Double,
    val bestDay: ChartBestDay,
)

data class ChartBestDay(
    val date: String,
    val totalEgp: Double,
    val count: Int,
)

data class TransactionList(
    val transactions: List<Transaction>,
    val pagination: Pagination,
)

data class Pagination(
    val limit: Int,
    val hasMore: Boolean,
    val nextCursor: String?,
    val count: Int,
)
