import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import {
  buildDeepLink,
  generateShortToken,
  getMerchantConfig,
} from '@/lib/merchant'

interface CreateCheckoutBody {
  senderHandle: string
  amountEgp: number
  note?: string
}

// Normalize whatever the client typed into a canonical <local>@instapay handle.
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
    const body = (await request.json()) as CreateCheckoutBody

    const senderHandle = normalizeHandle(body.senderHandle)
    const amountEgp = Number(body.amountEgp)
    const note = (body.note || '').trim() || null

    if (!senderHandle) {
      return NextResponse.json(
        { ok: false, error: 'Please enter your InstaPay username exactly as it appears in the InstaPay app.' },
        { status: 400 }
      )
    }
    if (senderHandle === config.handle) {
      return NextResponse.json(
        { ok: false, error: 'You cannot send money to yourself.' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(amountEgp) || amountEgp <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Amount must be a positive number.' },
        { status: 400 }
      )
    }
    if (amountEgp > 1_000_000) {
      return NextResponse.json(
        { ok: false, error: 'Amount exceeds the per-transaction limit (1,000,000 EGP).' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + config.checkoutTtlMinutes * 60 * 1000
    )

    // Build the official InstaPay deep link for this checkout.
    const shortToken = generateShortToken()
    const deepLinkUrl = buildDeepLink(config.localPart, shortToken)

    // Render the deep link as a QR code (data URL, PNG base64).
    // The QR encodes the deep link URL so scanning it opens the InstaPay app
    // with the recipient pre-filled.
    const qrCodeDataUrl = await QRCode.toDataURL(deepLinkUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
    })

    const tx = await db.transaction.create({
      data: {
        senderHandle,
        recipientHandle: config.handle,
        amountEgp: Math.round(amountEgp * 100) / 100,
        currency: 'EGP',
        status: 'PENDING',
        note,
        deepLinkUrl,
        deepLinkToken: shortToken,
        createdAt: now,
        expiresAt,
      },
    })

    return NextResponse.json({
      ok: true,
      checkout: {
        sessionId: tx.sessionId,
        senderHandle: tx.senderHandle,
        recipientHandle: tx.recipientHandle,
        merchantName: config.name,
        amountEgp: tx.amountEgp,
        currency: tx.currency,
        status: tx.status,
        note: tx.note,
        deepLinkUrl: tx.deepLinkUrl,
        deepLinkToken: tx.deepLinkToken,
        qrCodeDataUrl,
        createdAt: tx.createdAt.toISOString(),
        expiresAt: tx.expiresAt.toISOString(),
        ttlSeconds: config.checkoutTtlMinutes * 60,
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
