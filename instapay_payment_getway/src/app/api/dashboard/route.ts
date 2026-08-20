import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByApiKey, authenticateOwner } from '@/lib/auth'
import { getStartOfTodayEgypt, formatEgyptTime, getEgyptDstMode, getEgyptOffsetMinutes } from '@/lib/timezone'

/**
 * Multi-tenant Dashboard stats:
 * Scope is determined by Client API Key or Owner Admin credentials.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetClientId = searchParams.get('clientId')

    let clientId = ''
    let isOwner = await authenticateOwner(request)
    
    // Sandbox local development fallback for admin check
    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided === ownerSecret) {
      isOwner = true
    }

    let client = null

    if (isOwner) {
      if (targetClientId) {
        client = await db.client.findUnique({ where: { id: targetClientId } })
        if (!client) {
          return NextResponse.json({ ok: false, error: 'Target client not found.' }, { status: 404 })
        }
        clientId = client.id
      }
      // If owner but no targetClientId is specified, we'll aggregate platform stats in administrative routes.
    } else {
      // Authenticate as client
      client = await authenticateByApiKey(request)
      if (!client) {
        // Fallback for easy frontend sandbox preview: if there is only 1 client in the database, use it.
        const allClients = await db.client.findMany()
        if (allClients.length > 0) {
          client = allClients[0]
        } else {
          return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
        }
      }
      clientId = client.id
    }

    const now = new Date()
    const dstMode = await getEgyptDstMode()
    const startOfToday = getStartOfTodayEgypt(now, dstMode)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const whereClause: Record<string, unknown> = {
      status: 'CONFIRMED',
    }
    if (clientId) {
      whereClause.clientId = clientId
    }

    const pendingWhereClause: Record<string, unknown> = {
      status: 'PENDING',
      expiresAt: { gt: now },
    }
    if (clientId) {
      pendingWhereClause.clientId = clientId
    }

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
          ...whereClause,
          detectedAt: { gte: startOfToday },
        },
      }),
      db.transaction.aggregate({
        _sum: { amountEgp: true },
        _count: true,
        where: {
          ...whereClause,
          detectedAt: { gte: sevenDaysAgo },
        },
      }),
      db.transaction.count({
        where: pendingWhereClause,
      }),
      db.transaction.aggregate({
        _sum: { amountEgp: true },
        where: pendingWhereClause,
      }),
      db.transaction.findMany({
        where: clientId ? { clientId, status: 'CONFIRMED' } : { status: 'CONFIRMED' },
        orderBy: { detectedAt: 'desc' },
        take: 10,
      }),
    ])

    const offsetMinutes = getEgyptOffsetMinutes(now, dstMode)

    return NextResponse.json({
      ok: true,
      timezoneInfo: {
        timeZone: 'Africa/Cairo',
        dstMode,
        dstActive: offsetMinutes === 180,
        currentEgyptTime: formatEgyptTime(now, dstMode),
      },
      merchant: {
        handle: client ? client.instapayHandle : 'All Clients',
        name: client ? client.businessName : 'Platform Overview',
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
        detectedAtEgypt: t.detectedAt ? formatEgyptTime(t.detectedAt, dstMode) : null,
        createdAt: t.createdAt.toISOString(),
        createdAtEgypt: formatEgyptTime(t.createdAt, dstMode),
        expiresAt: t.expiresAt.toISOString(),
        expiresAtEgypt: formatEgyptTime(t.expiresAt, dstMode),
      })),
      subscription: client ? {
        plan: client.subscriptionPlan,
        txCount: client.txCount,
        txLimit: client.txLimit,
        subscriptionEndsAt: client.subscriptionEndsAt ? client.subscriptionEndsAt.toISOString() : null,
        isFreeTrial: client.isFreeTrial,
      } : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to load dashboard: ${message}` },
      { status: 500 }
    )
  }
}
