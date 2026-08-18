import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'

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
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 100)
    const cursorIso = searchParams.get('cursor')

    const where: Record<string, any> = {}

    if (cursorIso) {
      const cursorDate = new Date(cursorIso)
      if (!isNaN(cursorDate.getTime())) {
        where.createdAt = { lt: cursorDate }
      }
    }

    const logs = await db.auditLog.findMany({
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
        action: l.action,
        details: l.details,
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
      { ok: false, error: `Failed to fetch audit logs: ${message}` },
      { status: 500 }
    )
  }
}
