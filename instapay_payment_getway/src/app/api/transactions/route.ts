import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatEgyptTime } from '@/lib/timezone'

/**
 * Paginated, searchable list of ALL transactions (confirmed + pending + expired)
 * for the merchant dashboard's "Transactions" screen.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim().toLowerCase() || ''
    const status = searchParams.get('status')?.toUpperCase()
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200)
    const cursorIso = searchParams.get('cursor')

    // Build the where clause
    const where: Record<string, unknown> = {}

    if (status === 'PENDING' || status === 'CONFIRMED' || status === 'EXPIRED') {
      where.status = status
    }

    if (q) {
      where.OR = [
        { senderHandle: { contains: q } },
        { detectedRef: { contains: q } },
        { note: { contains: q } },
        { sessionId: { contains: q } },
      ]
    }

    if (cursorIso) {
      const cursorDate = new Date(cursorIso)
      if (!isNaN(cursorDate.getTime())) {
        where.createdAt = { lt: cursorDate }
      }
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // +1 to know if there's a next page
    })

    const hasMore = transactions.length > limit
    const items = hasMore ? transactions.slice(0, limit) : transactions
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null

    return NextResponse.json({
      ok: true,
      transactions: items.map((t) => ({
        sessionId: t.sessionId,
        senderHandle: t.senderHandle,
        recipientHandle: t.recipientHandle,
        amountEgp: t.amountEgp,
        currency: t.currency,
        status: t.status,
        note: t.note,
        deepLinkUrl: t.deepLinkUrl,
        deepLinkToken: t.deepLinkToken,
        detectedRef: t.detectedRef,
        detectedAt: t.detectedAt?.toISOString() ?? null,
        detectedAtEgypt: t.detectedAt ? formatEgyptTime(t.detectedAt) : null,
        createdAt: t.createdAt.toISOString(),
        createdAtEgypt: formatEgyptTime(t.createdAt),
        expiresAt: t.expiresAt.toISOString(),
        expiresAtEgypt: formatEgyptTime(t.expiresAt),
      })),
      pagination: {
        limit,
        hasMore,
        nextCursor,
        count: items.length,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to load transactions: ${message}` },
      { status: 500 }
    )
  }
}
