import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { getSessionClient } from '@/lib/auth'
import { resolveInstaPayPaymentLink } from '@/lib/merchant'
import { toEgpCents } from '@/lib/money'

export async function POST(request: NextRequest) {
  try {
    const client = await getSessionClient(request)
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json()
    const planName = String(body?.planName || '').trim().toUpperCase()
    if (!planName || planName === 'FREE_TRIAL') {
      return NextResponse.json({ ok: false, error: 'Choose a paid plan.' }, { status: 400 })
    }

    const plan = await db.plan.findUnique({ where: { name: planName } })
    if (!plan || plan.priceEgp <= 0) {
      return NextResponse.json({ ok: false, error: 'Plan not found or not payable.' }, { status: 404 })
    }

    const platformHandle = process.env.PLATFORM_INSTAPAY_HANDLE
    if (!platformHandle) {
      return NextResponse.json(
        { ok: false, error: 'PLATFORM_INSTAPAY_HANDLE is not configured.' },
        { status: 500 }
      )
    }

    const amountCents = toEgpCents(plan.priceEgp)
    const { deepLinkUrl, token } = resolveInstaPayPaymentLink(
      platformHandle,
      process.env.PLATFORM_INSTAPAY_PAYMENT_URL
    )
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    const transaction = await db.transaction.create({
      data: {
        clientId: client.id,
        senderHandle: client.instapayHandle,
        recipientHandle: platformHandle,
        amountEgp: amountCents / 100,
        amountCents,
        currency: 'EGP',
        status: 'PENDING',
        purpose: 'SUBSCRIPTION',
        subscriptionPlanName: plan.name,
        note: `Subscription payment for ${plan.name}`,
        deepLinkUrl,
        deepLinkToken: token,
        expiresAt,
      },
    })

    const qrCodeDataUrl = await QRCode.toDataURL(deepLinkUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#111827', light: '#FFFFFF' },
    })

    return NextResponse.json({
      ok: true,
      checkout: {
        sessionId: transaction.sessionId,
        planName: plan.name,
        amountEgp: transaction.amountEgp,
        currency: transaction.currency,
        senderHandle: transaction.senderHandle,
        recipientHandle: transaction.recipientHandle,
        deepLinkUrl: transaction.deepLinkUrl,
        deepLinkToken: transaction.deepLinkToken,
        qrCodeDataUrl,
        status: transaction.status,
        expiresAt: transaction.expiresAt.toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to create subscription checkout: ${message}` }, { status: 500 })
  }
}
