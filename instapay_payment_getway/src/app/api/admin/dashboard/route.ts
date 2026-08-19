import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'
import { getStartOfTodayEgypt, formatEgyptTime, getEgyptDstMode } from '@/lib/timezone'

/**
 * GET: Platform-wide summary stats for admin dashboard.
 */
export async function GET(request: NextRequest) {
  const isOwner = await authenticateOwner(request)
  if (!isOwner) {
    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const now = new Date()
    const dstMode = await getEgyptDstMode()
    const startOfToday = getStartOfTodayEgypt(now, dstMode)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalClients,
      activeClients,
      todayConfirmed,
      sevenDayConfirmed,
      pendingTx,
      recentTransactions,
    ] = await Promise.all([
      db.client.count(),
      db.client.count({ where: { isActive: true } }),
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
      db.transaction.aggregate({
        _sum: { amountEgp: true },
        _count: true,
        where: {
          status: 'PENDING',
          expiresAt: { gt: now },
        },
      }),
      db.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          client: {
            select: { businessName: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      stats: {
        totalClients,
        activeClients,
        today: {
          count: todayConfirmed._count,
          totalEgp: todayConfirmed._sum.amountEgp ?? 0,
        },
        sevenDays: {
          count: sevenDayConfirmed._count,
          totalEgp: sevenDayConfirmed._sum.amountEgp ?? 0,
        },
        pending: {
          count: pendingTx._count,
          totalEgp: pendingTx._sum.amountEgp ?? 0,
        },
      },
      recent: recentTransactions.map((tx) => ({
        sessionId: tx.sessionId,
        businessName: tx.client.businessName,
        senderHandle: tx.senderHandle,
        recipientHandle: tx.recipientHandle,
        amountEgp: tx.amountEgp,
        status: tx.status,
        detectedRef: tx.detectedRef,
        detectedAt: tx.detectedAt?.toISOString() ?? null,
        detectedAtEgypt: tx.detectedAt ? formatEgyptTime(tx.detectedAt, dstMode) : null,
        createdAt: tx.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to compile stats: ${message}` }, { status: 500 })
  }
}
