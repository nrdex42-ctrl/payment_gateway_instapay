import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionClient, generateSecureToken } from '@/lib/auth'

/**
 * PATCH: Update merchant custom integration settings.
 */
export async function PATCH(request: NextRequest) {
  try {
    const client = await getSessionClient(request)
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json()
    const { webhookUrl, checkoutTtlMin, regenerateWebhookSecret, regenerateApiKey, regenerateDetectToken } = body || {}

    const data: Record<string, any> = {}

    if (webhookUrl !== undefined) {
      data.webhookUrl = webhookUrl ? String(webhookUrl).trim() : null
    }

    if (checkoutTtlMin !== undefined) {
      const ttl = Number(checkoutTtlMin)
      if (Number.isInteger(ttl) && ttl >= 1 && ttl <= 180) {
        data.checkoutTtlMin = ttl
      }
    }

    if (regenerateWebhookSecret) {
      data.webhookSecret = generateSecureToken('sec')
    }

    if (regenerateApiKey) {
      data.apiKey = generateSecureToken('ipk')
    }

    if (regenerateDetectToken) {
      data.detectToken = generateSecureToken('det')
    }

    const updated = await db.client.update({
      where: { id: client.id },
      data,
    })

    return NextResponse.json({
      ok: true,
      message: 'Integration settings updated successfully.',
      client: {
        id: updated.id,
        businessName: updated.businessName,
        instapayHandle: updated.instapayHandle,
        email: updated.email,
        apiKey: updated.apiKey,
        detectToken: updated.detectToken,
        webhookUrl: updated.webhookUrl,
        webhookSecret: updated.webhookSecret,
        checkoutTtlMin: updated.checkoutTtlMin,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to update settings: ${message}` }, { status: 500 })
  }
}
