import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getEgyptDayKey, getEgyptDstMode } from '@/lib/timezone'
import { authenticateByApiKey, authenticateByDetectToken, authenticateOwner } from '@/lib/auth'

/**
 * Returns a daily revenue series for the merchant dashboard's chart in Egypt Local Time.
 * Query params:
 *   ?days=<n>    — number of days to include (default 30, max 90)
 *   ?clientId=id — target client ID (owner only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || 30), 1), 90)
    const targetClientId = searchParams.get('clientId')

    let clientId = ''
    const isOwner = await authenticateOwner(request)

    if (isOwner) {
      if (targetClientId) {
        clientId = targetClientId
      }
    } else {
      const client = await authenticateByApiKey(request) ?? await authenticateByDetectToken(request)
      if (!client) {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
      } else {
        clientId = client.id
      }
    }

    const now = new Date()
    const dstMode = await getEgyptDstMode()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - (days - 1))
    startDate.setHours(0, 0, 0, 0)

    const whereClause: Record<string, unknown> = {
      status: 'CONFIRMED',
      detectedAt: { gte: startDate },
    }
    if (clientId) {
      whereClause.clientId = clientId
    }

    // Aggregate confirmed transactions by day
    const rows = await db.transaction.findMany({
      where: whereClause as any,
      select: {
        amountEgp: true,
        detectedAt: true,
      },
    })

    // Build a map of date -> { total, count } in Egypt Local Date
    const dayMap = new Map<string, { totalEgp: number; count: number }>()

    for (const row of rows) {
      if (!row.detectedAt) continue
      const dayKey = getEgyptDayKey(row.detectedAt, dstMode)
      const entry = dayMap.get(dayKey) || { totalEgp: 0, count: 0 }
      entry.totalEgp += row.amountEgp
      entry.count += 1
      dayMap.set(dayKey, entry)
    }

    // Build the full series (including zero-revenue days) in Egypt Local Time
    const series: Array<{ date: string; totalEgp: number; count: number }> = []
    const cursor = new Date(startDate)
    while (cursor <= now) {
      const dayKey = getEgyptDayKey(cursor, dstMode)
      const entry = dayMap.get(dayKey) || { totalEgp: 0, count: 0 }
      series.push({
        date: dayKey,
        totalEgp: Math.round(entry.totalEgp * 100) / 100,
        count: entry.count,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    // Also compute summary stats
    const totalRevenue = series.reduce((sum, d) => sum + d.totalEgp, 0)
    const totalCount = series.reduce((sum, d) => sum + d.count, 0)
    const avgPerDay = totalRevenue / days
    const bestDay = series.reduce(
      (best, d) => (d.totalEgp > best.totalEgp ? d : best),
      series[0] || { date: '', totalEgp: 0, count: 0 }
    )

    return NextResponse.json({
      ok: true,
      range: { days, startDate: startDate.toISOString(), endDate: now.toISOString() },
      series,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCount,
        avgPerDay: Math.round(avgPerDay * 100) / 100,
        bestDay: {
          date: bestDay.date,
          totalEgp: Math.round(bestDay.totalEgp * 100) / 100,
          count: bestDay.count,
        },
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to load chart data: ${message}` },
      { status: 500 }
    )
  }
}
