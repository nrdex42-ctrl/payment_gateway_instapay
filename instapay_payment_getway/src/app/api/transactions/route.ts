import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatEgyptTime, getEgyptDstMode } from '@/lib/timezone'
import { authenticateByApiKey, authenticateOwner } from '@/lib/auth'
import { egpAmountFromRow } from '@/lib/money'

/**
 * Paginated, searchable list of transactions for a specific client (or all for admin).
 */
export async function GET(request: NextRequest) {
  try {
    const dstMode = await getEgyptDstMode()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim().toLowerCase() || ''
    const status = searchParams.get('status')?.toUpperCase()
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200)
    const cursorIso = searchParams.get('cursor')
    const targetClientId = searchParams.get('clientId')
    const minAmount = searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : null
    const maxAmount = searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : null
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    let clientId = ''
    let isOwner = await authenticateOwner(request)

    // Local dev sandbox fallback for admin check
    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided === ownerSecret) {
      isOwner = true
    }

    if (isOwner) {
      if (targetClientId) {
        clientId = targetClientId
      }
    } else {
      const client = await authenticateByApiKey(request)
      if (!client) {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
      } else {
        clientId = client.id
      }
    }

    // Build the where clause
    const where: Record<string, any> = {}

    if (clientId) {
      where.clientId = clientId
    }

    if (['PENDING', 'CONFIRMED', 'EXPIRED', 'UNDERPAID'].includes(status || '')) {
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

    if (minAmount !== null && !isNaN(minAmount)) {
      where.amountEgp = { ...where.amountEgp, gte: minAmount }
    }
    if (maxAmount !== null && !isNaN(maxAmount)) {
      where.amountEgp = { ...where.amountEgp, lte: maxAmount }
    }

    if (startDateStr) {
      const start = new Date(startDateStr)
      if (!isNaN(start.getTime())) {
        where.createdAt = { ...where.createdAt, gte: start }
      }
    }
    if (endDateStr) {
      const end = new Date(endDateStr)
      if (!isNaN(end.getTime())) {
        where.createdAt = { ...where.createdAt, lte: end }
      }
    }

    if (cursorIso) {
      const cursorDate = new Date(cursorIso)
      if (!isNaN(cursorDate.getTime())) {
        where.createdAt = { ...where.createdAt, lt: cursorDate }
      }
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // +1 to know if there's a next page
      include: {
        client: {
          select: { businessName: true },
        },
      },
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
        businessName: t.client.businessName,
        senderHandle: t.senderHandle,
        recipientHandle: t.recipientHandle,
        amountEgp: egpAmountFromRow(t),
        currency: t.currency,
        status: t.status,
        note: t.note,
        deepLinkUrl: t.deepLinkUrl,
        deepLinkToken: t.deepLinkToken,
        detectedRef: t.detectedRef,
        detectedAt: t.detectedAt?.toISOString() ?? null,
        detectedAtEgypt: t.detectedAt ? formatEgyptTime(t.detectedAt, dstMode) : null,
        createdAt: t.createdAt.toISOString(),
        createdAtEgypt: formatEgyptTime(t.createdAt, dstMode),
        expiresAt: t.expiresAt.toISOString(),
        expiresAtEgypt: formatEgyptTime(t.expiresAt, dstMode),
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
