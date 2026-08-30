import { NextRequest, NextResponse } from 'next/server'
import { getSessionClient } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const client = await getSessionClient(request)
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        slug: client.slug,
        businessName: client.businessName,
        businessType: client.businessType,
        instapayHandle: client.instapayHandle,
        instapayPaymentUrl: client.instapayPaymentUrl,
        email: client.email,
        apiKey: client.apiKey,
        detectToken: client.detectToken,
        webhookUrl: client.webhookUrl,
        webhookSecret: client.webhookSecret,
        checkoutTtlMin: client.checkoutTtlMin,
        createdAt: client.createdAt.toISOString(),
        subscriptionPlan: client.subscriptionPlan,
        subscriptionEndsAt: client.subscriptionEndsAt ? client.subscriptionEndsAt.toISOString() : null,
        isFreeTrial: client.isFreeTrial,
        txLimit: client.txLimit,
        txCount: client.txCount,
      },
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Session validation failed.' }, { status: 500 })
  }
}
