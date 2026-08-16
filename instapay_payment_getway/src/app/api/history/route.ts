import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Returns the most recent confirmed checkouts (i.e. payments that were
 * successfully detected by the Android app and matched to a client request).
 * Intended for the merchant's own dashboard view.
 */
export async function GET() {
  try {
    const transactions = await db.transaction.findMany({
      where: { status: 'CONFIRMED' },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      ok: true,
      transactions: transactions.map((t) => ({
        sessionId: t.sessionId,
        senderHandle: t.senderHandle,
        recipientHandle: t.recipientHandle,
        amountEgp: t.amountEgp,
        currency: t.currency,
        status: t.status,
        note: t.note,
        detectedRef: t.detectedRef,
        detectedAt: t.detectedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to load history: ${message}` },
      { status: 500 }
    )
  }
}
