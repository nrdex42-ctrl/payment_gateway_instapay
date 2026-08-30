import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { detectedEgpAmountFromRow, egpAmountFromRow } from '@/lib/money'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'

export async function GET(request: NextRequest) {
  // Enforce Rate Limit: max 120 status checks per minute
  const rl = checkRateLimit(request, 120, 60 * 1000)
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: 'Too many status check requests. Please slow down.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'sessionId query parameter is required.' },
        { status: 400 }
      )
    }

    const transaction = await db.transaction.findUnique({
      where: { sessionId },
      include: {
        client: {
          select: { businessName: true, instapayHandle: true },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json(
        { ok: false, error: 'Checkout session not found.' },
        { status: 404 }
      )
    }

    // Auto-expire if past expiresAt and still PENDING
    const now = new Date()
    let currentStatus = transaction.status
    if (currentStatus === 'PENDING' && transaction.expiresAt < now) {
      currentStatus = 'EXPIRED'
      await db.transaction.update({
        where: { id: transaction.id },
        data: { status: 'EXPIRED' },
      })
    }

    return NextResponse.json({
      ok: true,
      checkout: {
        sessionId: transaction.sessionId,
        businessName: transaction.client.businessName,
        senderHandle: transaction.senderHandle,
        recipientHandle: transaction.recipientHandle,
        amountEgp: egpAmountFromRow(transaction),
        currency: transaction.currency,
        status: currentStatus,
        detectedRef: transaction.detectedRef,
        detectedAt: transaction.detectedAt?.toISOString() ?? null,
        detectedAmountEgp: detectedEgpAmountFromRow(transaction),
        createdAt: transaction.createdAt.toISOString(),
        expiresAt: transaction.expiresAt.toISOString(),
        note: transaction.note,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to fetch checkout status: ${message}` },
      { status: 500 }
    )
  }
}
