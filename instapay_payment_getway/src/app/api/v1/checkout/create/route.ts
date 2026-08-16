import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByApiKey } from '@/lib/auth'
import { buildInstaPayDeepLink, normalizeHandle } from '@/lib/merchant'

export async function POST(request: NextRequest) {
  try {
    // --- Authenticate Client by API Key ---
    const client = await authenticateByApiKey(request)
    if (!client) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized. Invalid API Key.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amountEgp, senderHandle, note } = body || {}

    if (!amountEgp || typeof amountEgp !== 'number' || amountEgp <= 0) {
      return NextResponse.json(
        { ok: false, error: 'amountEgp is required and must be a positive number.' },
        { status: 400 }
      )
    }

    if (!senderHandle || typeof senderHandle !== 'string' || !senderHandle.trim()) {
      return NextResponse.json(
        { ok: false, error: 'senderHandle is required (e.g. "customer@instapay").' },
        { status: 400 }
      )
    }

    const normalizedSender = normalizeHandle(senderHandle)
    if (!normalizedSender) {
      return NextResponse.json(
        { ok: false, error: 'Invalid sender handle format.' },
        { status: 400 }
      )
    }

    // Build the deep link to the client's InstaPay handle
    const { deepLinkUrl, token } = buildInstaPayDeepLink(client.instapayHandle)
    const expiresAt = new Date(Date.now() + client.checkoutTtlMin * 60 * 1000)

    const transaction = await db.transaction.create({
      data: {
        clientId: client.id,
        senderHandle: normalizedSender,
        recipientHandle: client.instapayHandle,
        amountEgp: Math.round(amountEgp * 100) / 100,
        currency: 'EGP',
        status: 'PENDING',
        note: note ? String(note).slice(0, 200) : null,
        deepLinkUrl,
        deepLinkToken: token,
        expiresAt,
      },
    })

    return NextResponse.json({
      ok: true,
      checkout: {
        sessionId: transaction.sessionId,
        senderHandle: transaction.senderHandle,
        recipientHandle: transaction.recipientHandle,
        amountEgp: transaction.amountEgp,
        currency: transaction.currency,
        status: transaction.status,
        note: transaction.note,
        deepLinkUrl: transaction.deepLinkUrl,
        deepLinkToken: transaction.deepLinkToken,
        createdAt: transaction.createdAt.toISOString(),
        expiresAt: transaction.expiresAt.toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to create checkout: ${message}` },
      { status: 500 }
    )
  }
}
