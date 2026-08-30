import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatEgyptTime, getEgyptDstMode } from '@/lib/timezone'
import { authenticateByApiKey, authenticateByDetectToken, authenticateOwner, getSessionClient } from '@/lib/auth'
import { forwardToClientWebhook } from '@/lib/webhook'
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

/**
 * Manually update transaction status (e.g. mark PENDING as CONFIRMED, EXPIRED, UNDERPAID, or CANCELLED)
 */
export async function PATCH(request: NextRequest) {
  try {
    const isOwner = await authenticateOwner(request)
    let authedClientId = ''

    if (!isOwner) {
      const client = (await getSessionClient(request)) ?? (await authenticateByApiKey(request))
      if (!client) {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
      }
      authedClientId = client.id
    }

    const body = await request.json()
    const { sessionId, newStatus, detectedRef } = body || {}

    const validStatuses = ['CONFIRMED', 'PENDING', 'EXPIRED', 'UNDERPAID', 'FAILED', 'CANCELLED']
    const normalizedStatus = String(newStatus || '').toUpperCase()

    if (!sessionId || !validStatuses.includes(normalizedStatus)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const tx = await db.transaction.findUnique({
      where: { sessionId },
      include: { client: true },
    })

    if (!tx) {
      return NextResponse.json({ ok: false, error: 'Transaction not found.' }, { status: 404 })
    }

    if (!isOwner && tx.clientId !== authedClientId) {
      return NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 })
    }

    const now = new Date()
    const wasPending = tx.status === 'PENDING'
    const isNowConfirmed = normalizedStatus === 'CONFIRMED'

    const updated = await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: normalizedStatus,
        detectedAt: isNowConfirmed ? (tx.detectedAt || now) : tx.detectedAt,
        detectedRef: isNowConfirmed ? (detectedRef?.trim() || tx.detectedRef || 'MANUAL_OVERRIDE') : tx.detectedRef,
      },
    })

    // If confirmed manually, increment client quota and dispatch webhook if configured
    if (isNowConfirmed && wasPending) {
      await db.client.update({
        where: { id: tx.clientId },
        data: { txCount: { increment: 1 } },
      }).catch(() => {})

      if (tx.client.webhookUrl) {
        await forwardToClientWebhook(tx.clientId, tx.client.webhookUrl, tx.client.webhookSecret, {
          event: 'payment.confirmed',
          clientId: tx.clientId,
          businessName: tx.client.businessName,
          transaction: {
            sessionId: updated.sessionId,
            senderHandle: updated.senderHandle,
            recipientHandle: updated.recipientHandle,
            amountEgp: updated.amountEgp,
            currency: updated.currency,
            status: updated.status,
            detectedRef: updated.detectedRef,
            detectedAt: updated.detectedAt?.toISOString() ?? null,
            note: updated.note,
            createdAt: updated.createdAt.toISOString(),
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      ok: true,
      transaction: {
        sessionId: updated.sessionId,
        status: updated.status,
        detectedRef: updated.detectedRef,
        detectedAt: updated.detectedAt?.toISOString() ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to update transaction: ${message}` }, { status: 500 })
  }
}
