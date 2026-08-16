import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMerchantConfig } from '@/lib/merchant'

/**
 * Merchant dashboard stats:
 *   - Today's confirmed total + count
 *   - Last 7 days confirmed total + count
 *   - Currently pending checkouts (awaiting payment)
 *   - Last 10 confirmed payments (for the recent-activity list)
 */
export async function GET() {
  try {
    const config = getMerchantConfig()

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      todayConfirmed,
      sevenDayConfirmed,
      pendingCount,
      pendingTotal,
      recent,
    ] = await Promise.all([
      db.transaction.aggregate({
        _sum: { amountEgp: true },
        _count: true,
        where: {
          status: 'CONFIRMED',
          detectedAt: { gte: startOfToday },
        },
      }),
      db.transaction.aggregate({
        _sum: { amountEgp: true },
        _count: true,
        where: {
          status: 'CONFIRMED',
          detectedAt: { gte: sevenDaysAgo },
        },
      }),
      db.transaction.count({
        where: {
          status: 'PENDING',
          expiresAt: { gt: now },
        },
      }),
      db.transaction.aggregate({
        _sum: { amountEgp: true },
        where: {
          status: 'PENDING',
          expiresAt: { gt: now },
        },
      }),
      db.transaction.findMany({
        where: { status: 'CONFIRMED' },
        orderBy: { detectedAt: 'desc' },
        take: 10,
      }),
    ])

    return NextResponse.json({
      ok: true,
      merchant: {
        handle: config.handle,
        name: config.name,
      },
      stats: {
        today: {
          count: todayConfirmed._count,
          totalEgp: todayConfirmed._sum.amountEgp ?? 0,
        },
        sevenDays: {
          count: sevenDayConfirmed._count,
          totalEgp: sevenDayConfirmed._sum.amountEgp ?? 0,
        },
        pending: {
          count: pendingCount,
          totalEgp: pendingTotal._sum.amountEgp ?? 0,
        },
      },
      recent: recent.map((t) => ({
        sessionId: t.sessionId,
        senderHandle: t.senderHandle,
        recipientHandle: t.recipientHandle,
        amountEgp: t.amountEgp,
        currency: t.currency,
        status: t.status,
        note: t.note,
        detectedRef: t.detectedRef,
        detectedAt: t.detectedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to load dashboard: ${message}` },
      { status: 500 }
    )
  }
}
