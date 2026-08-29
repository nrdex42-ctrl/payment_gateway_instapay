import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'
import { retryWebhook } from '@/lib/webhook'

export async function POST(request: NextRequest) {
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
    const pendingLogs = await db.webhookLog.findMany({
      where: {
        isSuccess: false,
        attempt: { lt: 5 },
        nextAttemptAt: { lte: now },
      },
      take: 20,
    })

    if (pendingLogs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No pending failed webhooks to retry.',
        retriedCount: 0,
      })
    }

    const promises = pendingLogs.map((log) => retryWebhook(log.id))
    await Promise.all(promises)

    return NextResponse.json({
      ok: true,
      message: `Successfully executed retry attempts for ${pendingLogs.length} webhooks.`,
      retriedCount: pendingLogs.length,
      retriedIds: pendingLogs.map((l) => l.id),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Webhook retry execution failed: ${message}` },
      { status: 500 }
    )
  }
}
