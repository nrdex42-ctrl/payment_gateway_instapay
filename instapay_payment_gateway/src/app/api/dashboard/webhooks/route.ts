import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const client = await authenticateByApiKey(request)
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 100)
    const cursorIso = searchParams.get('cursor')
    const successParam = searchParams.get('success')

    const where: Record<string, any> = {
      clientId: client.id,
    }

    if (successParam === 'true') {
      where.isSuccess = true
    } else if (successParam === 'false') {
      where.isSuccess = false
    }

    if (cursorIso) {
      const cursorDate = new Date(cursorIso)
      if (!isNaN(cursorDate.getTime())) {
        where.createdAt = { lt: cursorDate }
      }
    }

    const logs = await db.webhookLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })

    const hasMore = logs.length > limit
    const items = hasMore ? logs.slice(0, limit) : logs
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null

    return NextResponse.json({
      ok: true,
      logs: items.map((l) => ({
        id: l.id,
        url: l.url,
        event: l.event,
        payload: l.payload,
        statusCode: l.statusCode,
        response: l.response,
        isSuccess: l.isSuccess,
        createdAt: l.createdAt.toISOString(),
      })),
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to fetch merchant webhook logs: ${message}` },
      { status: 500 }
    )
  }
}
