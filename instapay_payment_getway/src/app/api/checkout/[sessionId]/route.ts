import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{ sessionId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params

    const tx = await db.transaction.findUnique({
      where: { sessionId },
      include: {
        client: {
          select: { businessName: true },
        },
      },
    })

    if (!tx) {
      return NextResponse.json(
        { ok: false, error: 'Checkout not found.' },
        { status: 404 }
      )
    }

    // Lazy expiry: if the checkout is still PENDING but past its TTL, mark it EXPIRED
    // so the client UI can transition to the expired state immediately.
    let status = tx.status
    if (status === 'PENDING' && tx.expiresAt.getTime() < Date.now()) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: 'EXPIRED' },
      })
      status = 'EXPIRED'
    }

    const now = Date.now()
    const secondsRemaining = Math.max(
      0,
      Math.floor((tx.expiresAt.getTime() - now) / 1000)
    )

    return NextResponse.json({
      ok: true,
      checkout: {
        sessionId: tx.sessionId,
        senderHandle: tx.senderHandle,
        recipientHandle: tx.recipientHandle,
        merchantName: tx.client.businessName, // Map client businessName to merchantName
        amountEgp: tx.amountEgp,
        currency: tx.currency,
        status,
        note: tx.note,
        deepLinkUrl: tx.deepLinkUrl,
        deepLinkToken: tx.deepLinkToken,
        detectedRef: tx.detectedRef,
        detectedAt: tx.detectedAt?.toISOString() ?? null,
        createdAt: tx.createdAt.toISOString(),
        expiresAt: tx.expiresAt.toISOString(),
        secondsRemaining,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to fetch checkout: ${message}` },
      { status: 500 }
    )
  }
}
