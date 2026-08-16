import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMerchantConfig, buildInstaPayDeepLink } from '@/lib/merchant'

function normalizeHandle(raw: string): string {
  let h = (raw || '').trim().toLowerCase().replace(/^@/, '')
  if (!h) return ''
  const local = h.split('@')[0]
  if (!local) return ''
  return `${local}@instapay`
}

export async function POST(request: NextRequest) {
  try {
    const config = getMerchantConfig()
    const body = await request.json()

    const { amountEgp, senderHandle, note } = body || {}

    if (!amountEgp || typeof amountEgp !== 'number' || amountEgp <= 0) {
      return NextResponse.json(
        { ok: false, error: 'amountEgp is required and must be a positive number.' },
        { status: 400 }
      )
    }

    if (!senderHandle || typeof senderHandle !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'senderHandle is required (e.g. "user@instapay").' },
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

    const { deepLinkUrl, token } = buildInstaPayDeepLink(config.handle)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes TTL

    const transaction = await db.transaction.create({
      data: {
        senderHandle: normalizedSender,
        recipientHandle: config.handle,
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
