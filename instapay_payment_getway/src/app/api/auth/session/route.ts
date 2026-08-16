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
        instapayHandle: client.instapayHandle,
        email: client.email,
        apiKey: client.apiKey,
        detectToken: client.detectToken,
        webhookUrl: client.webhookUrl,
        webhookSecret: client.webhookSecret,
        checkoutTtlMin: client.checkoutTtlMin,
        createdAt: client.createdAt.toISOString(),
      },
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Session validation failed.' }, { status: 500 })
  }
}
