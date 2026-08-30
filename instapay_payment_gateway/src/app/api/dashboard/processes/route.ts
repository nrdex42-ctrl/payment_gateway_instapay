import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByApiKey, authenticateOwner } from '@/lib/auth'
import { formatEgyptTime, getEgyptDstMode } from '@/lib/timezone'
import { egpAmountFromRow } from '@/lib/money'

export async function GET(request: NextRequest) {
  try {
    const client = await authenticateByApiKey(request)
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const dstMode = await getEgyptDstMode()
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 1. Fetch Webhook statistics
    const [webhookTotal, webhookSuccess, webhookFailed, pendingRetries, recentWebhookLogs] = await Promise.all([
      db.webhookLog.count({ where: { clientId: client.id } }),
      db.webhookLog.count({ where: { clientId: client.id, isSuccess: true } }),
      db.webhookLog.count({ where: { clientId: client.id, isSuccess: false } }),
      db.webhookLog.count({ where: { clientId: client.id, isSuccess: false, nextAttemptAt: { gt: now } } }),
      db.webhookLog.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    // 2. Fetch Transaction process statistics
    const [pendingCount, confirmedCount, expiredCount, recentTransactions] = await Promise.all([
      db.transaction.count({
        where: { clientId: client.id, status: 'PENDING', expiresAt: { gt: now } },
      }),
      db.transaction.count({
        where: { clientId: client.id, status: 'CONFIRMED' },
      }),
      db.transaction.count({
        where: { clientId: client.id, status: 'EXPIRED' },
      }),
      db.transaction.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ])

    // 3. Compute Matcher throughput & average confirmation time
    const recentConfirmedWithTimings = await db.transaction.findMany({
      where: {
        clientId: client.id,
        status: 'CONFIRMED',
        detectedAt: { not: null },
      },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    })

    let avgConfirmationSec = 0
    if (recentConfirmedWithTimings.length > 0) {
      const totalSec = recentConfirmedWithTimings.reduce((sum, tx) => {
        if (!tx.detectedAt) return sum
        const diffSec = Math.max(0, Math.floor((tx.detectedAt.getTime() - tx.createdAt.getTime()) / 1000))
        return sum + diffSec
      }, 0)
      avgConfirmationSec = Math.round(totalSec / recentConfirmedWithTimings.length)
    }

    // 4. Detector Companion Health
    const lastDetectorUsed = client.detectTokenLastUsedAt
    const isDetectorActive = lastDetectorUsed ? (now.getTime() - lastDetectorUsed.getTime() < 5 * 60 * 1000) : false
    const lastDetectorDiffMins = lastDetectorUsed ? Math.floor((now.getTime() - lastDetectorUsed.getTime()) / 60000) : null

    // 5. Build Unified Live Event Stream
    interface ProcessEvent {
      id: string
      type: 'checkout_created' | 'payment_confirmed' | 'payment_expired' | 'webhook_dispatched'
      title: string
      description: string
      timestamp: string
      timestampEgypt: string
      status: 'success' | 'warning' | 'pending' | 'error'
      meta?: Record<string, unknown>
    }

    const events: ProcessEvent[] = []

    recentTransactions.forEach((tx) => {
      events.push({
        id: `tx-create-${tx.id}`,
        type: 'checkout_created',
        title: `Checkout Created: ${egpAmountFromRow(tx)} EGP`,
        description: `Customer ${tx.senderHandle} • Session ${tx.sessionId.slice(0, 12)}...`,
        timestamp: tx.createdAt.toISOString(),
        timestampEgypt: formatEgyptTime(tx.createdAt, dstMode),
        status: 'pending',
        meta: { sessionId: tx.sessionId, amount: egpAmountFromRow(tx), handle: tx.senderHandle },
      })

      if (tx.status === 'CONFIRMED' && tx.detectedAt) {
        events.push({
          id: `tx-confirm-${tx.id}`,
          type: 'payment_confirmed',
          title: `Payment Matched & Confirmed: ${egpAmountFromRow(tx)} EGP`,
          description: `Ref: ${tx.detectedRef || 'N/A'} • Confirmed in ${Math.max(0, Math.floor((tx.detectedAt.getTime() - tx.createdAt.getTime()) / 1000))}s`,
          timestamp: tx.detectedAt.toISOString(),
          timestampEgypt: formatEgyptTime(tx.detectedAt, dstMode),
          status: 'success',
          meta: { sessionId: tx.sessionId, amount: egpAmountFromRow(tx), ref: tx.detectedRef },
        })
      } else if (tx.status === 'EXPIRED') {
        events.push({
          id: `tx-expire-${tx.id}`,
          type: 'payment_expired',
          title: `Checkout Expired: ${egpAmountFromRow(tx)} EGP`,
          description: `TTL elapsed with no matching transfer detected`,
          timestamp: tx.expiresAt.toISOString(),
          timestampEgypt: formatEgyptTime(tx.expiresAt, dstMode),
          status: 'warning',
          meta: { sessionId: tx.sessionId },
        })
      }
    })

    recentWebhookLogs.forEach((wh) => {
      events.push({
        id: `wh-${wh.id}`,
        type: 'webhook_dispatched',
        title: `Webhook ${wh.isSuccess ? 'Delivered' : 'Failed'} (HTTP ${wh.statusCode || 'N/A'})`,
        description: `Event: ${wh.event} • URL: ${wh.url}`,
        timestamp: wh.createdAt.toISOString(),
        timestampEgypt: formatEgyptTime(wh.createdAt, dstMode),
        status: wh.isSuccess ? 'success' : 'error',
        meta: { url: wh.url, event: wh.event, statusCode: wh.statusCode },
      })
    })

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      ok: true,
      monitor: {
        detector: {
          isActive: isDetectorActive,
          lastSeenAt: lastDetectorUsed ? lastDetectorUsed.toISOString() : null,
          lastSeenMinsAgo: lastDetectorDiffMins,
          configuredHandle: client.instapayHandle,
          tokenConfigured: Boolean(client.detectToken),
        },
        matcher: {
          pendingSessions: pendingCount,
          confirmedTotal: confirmedCount,
          expiredTotal: expiredCount,
          avgConfirmationSpeedSec: avgConfirmationSec,
          matchRatePercent: (confirmedCount + expiredCount > 0)
            ? Math.round((confirmedCount / (confirmedCount + expiredCount)) * 100)
            : 100,
        },
        webhookWorker: {
          endpointUrl: client.webhookUrl,
          secretConfigured: Boolean(client.webhookSecret),
          totalDispatched: webhookTotal,
          successfulDispatched: webhookSuccess,
          failedDispatched: webhookFailed,
          pendingRetriesCount: pendingRetries,
          successRatePercent: webhookTotal > 0 ? Math.round((webhookSuccess / webhookTotal) * 100) : 100,
        },
        apiGateway: {
          keyLastUsedAt: client.apiKeyLastUsedAt ? client.apiKeyLastUsedAt.toISOString() : null,
          plan: client.subscriptionPlan,
          quotaUsed: client.txCount,
          quotaLimit: client.txLimit,
          checkoutTtlMin: client.checkoutTtlMin,
        },
        pipelineEvents: events.slice(0, 30),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to fetch process monitor: ${message}` },
      { status: 500 }
    )
  }
}
