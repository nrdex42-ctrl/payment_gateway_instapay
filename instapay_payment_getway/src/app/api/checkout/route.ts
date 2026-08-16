import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import {
  buildInstaPayDeepLink,
  getLocalPart,
  normalizeHandle,
} from '@/lib/merchant'

interface CreateCheckoutBody {
  senderHandle: string
  amountEgp: number
  note?: string
  clientSlug?: string
  clientId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCheckoutBody
    const { clientSlug, clientId } = body || {}

    // Find the client we are paying to
    let client = null
    if (clientSlug) {
      client = await db.client.findUnique({ where: { slug: clientSlug } })
    } else if (clientId) {
      client = await db.client.findUnique({ where: { id: clientId } })
    }

    if (!client) {
      return NextResponse.json(
        { ok: false, error: 'Merchant client not found.' },
        { status: 404 }
      )
    }

    if (!client.isActive || client.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        { ok: false, error: 'This merchant account is currently inactive or pending approval.' },
        { status: 403 }
      )
    }

    const senderHandle = normalizeHandle(body.senderHandle)
    const amountEgp = Number(body.amountEgp)
    const note = (body.note || '').trim() || null

    if (!senderHandle) {
      return NextResponse.json(
        { ok: false, error: 'Please enter your InstaPay username exactly as it appears in the InstaPay app.' },
        { status: 400 }
      )
    }
    if (senderHandle === client.instapayHandle) {
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
      now.getTime() + client.checkoutTtlMin * 60 * 1000
    )

    // Build the official InstaPay deep link for this client
    const { deepLinkUrl, token: shortToken } = buildInstaPayDeepLink(client.instapayHandle)

    // Render the deep link as a QR code
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
        clientId: client.id,
        senderHandle,
        recipientHandle: client.instapayHandle,
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
        merchantName: client.businessName,
        amountEgp: tx.amountEgp,
        currency: tx.currency,
        status: tx.status,
        note: tx.note,
        deepLinkUrl: tx.deepLinkUrl,
        deepLinkToken: tx.deepLinkToken,
        qrCodeDataUrl,
        createdAt: tx.createdAt.toISOString(),
        expiresAt: tx.expiresAt.toISOString(),
        ttlSeconds: client.checkoutTtlMin * 60,
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')?.trim()

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: 'slug parameter is required.' },
        { status: 400 }
      )
    }

    const client = await db.client.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        businessName: true,
        instapayHandle: true,
        isActive: true,
      },
    })

    if (!client) {
      return NextResponse.json(
        { ok: false, error: 'Merchant not found.' },
        { status: 404 }
      )
    }

    if (!client.isActive) {
      return NextResponse.json(
        { ok: false, error: 'Merchant account is inactive.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      ok: true,
      client,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch merchant details.' },
      { status: 500 }
    )
  }
}

