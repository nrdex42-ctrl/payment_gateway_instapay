import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByApiKey, authenticateOwner } from '@/lib/auth'

/**
 * Returns the most recent confirmed checkouts for the authenticated client.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetClientId = searchParams.get('clientId')

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
        // Fallback for sandbox dev: use first client if exists
        const allClients = await db.client.findMany()
        if (allClients.length > 0) {
          clientId = allClients[0].id
        } else {
          return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
        }
      } else {
        clientId = client.id
      }
    }

    const where: Record<string, any> = { status: 'CONFIRMED' }
    if (clientId) {
      where.clientId = clientId
    }

    const transactions = await db.transaction.findMany({
      where,
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
