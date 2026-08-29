import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionClient } from '@/lib/auth'
import { egpAmountFromRow } from '@/lib/money'

export async function GET(request: NextRequest) {
  try {
    const client = await getSessionClient(request)
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId') || ''
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'sessionId is required.' }, { status: 400 })
    }

    const tx = await db.transaction.findFirst({
      where: { sessionId, clientId: client.id, purpose: 'SUBSCRIPTION' },
    })
    if (!tx) {
      return NextResponse.json({ ok: false, error: 'Subscription checkout not found.' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      checkout: {
        sessionId: tx.sessionId,
        planName: tx.subscriptionPlanName,
        amountEgp: egpAmountFromRow(tx),
        currency: tx.currency,
        status: tx.status,
        expiresAt: tx.expiresAt.toISOString(),
        detectedAt: tx.detectedAt?.toISOString() ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to load subscription status: ${message}` }, { status: 500 })
  }
}
