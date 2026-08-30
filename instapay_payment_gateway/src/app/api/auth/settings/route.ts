import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionClient, generateSecureToken, hashSecret } from '@/lib/auth'
import { isAllowedWebhookUrl } from '@/lib/webhook'
import { normalizeInstaPayPaymentUrl } from '@/lib/merchant'

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
    const { businessName, businessType, instapayHandle, webhookUrl, instapayPaymentUrl, checkoutTtlMin, regenerateWebhookSecret, regenerateApiKey, regenerateDetectToken } = body || {}

    const data: Record<string, any> = {}

    if (businessName !== undefined) {
      const trimmedBusinessName = String(businessName || '').trim()
      if (!trimmedBusinessName) {
        return NextResponse.json({ ok: false, error: 'Business name is required.' }, { status: 400 })
      }
      if (trimmedBusinessName.length > 120) {
        return NextResponse.json({ ok: false, error: 'Business name must be 120 characters or less.' }, { status: 400 })
      }
      data.businessName = trimmedBusinessName
    }

    if (businessType !== undefined) {
      const trimmedBusinessType = String(businessType || '').trim()
      if (trimmedBusinessType && trimmedBusinessType.length > 80) {
        return NextResponse.json({ ok: false, error: 'Business type must be 80 characters or less.' }, { status: 400 })
      }
      data.businessType = trimmedBusinessType || null
    }

    if (instapayHandle !== undefined) {
      const rawHandle = String(instapayHandle || '').trim().toLowerCase().replace(/^@/, '')
      if (!rawHandle) {
        return NextResponse.json({ ok: false, error: 'InstaPay receiving handle is required.' }, { status: 400 })
      }
      const localPart = rawHandle.split('@')[0]
      if (!/^[a-z0-9._-]{3,64}$/.test(localPart)) {
        return NextResponse.json(
          { ok: false, error: 'InstaPay handle must be 3-64 characters using letters, numbers, dots, underscores, or dashes.' },
          { status: 400 }
        )
      }
      data.instapayHandle = `${localPart}@instapay`
    }

    if (webhookUrl !== undefined) {
      const trimmedWebhookUrl = webhookUrl ? String(webhookUrl).trim() : ''
      if (trimmedWebhookUrl && !isAllowedWebhookUrl(trimmedWebhookUrl)) {
        return NextResponse.json(
          { ok: false, error: 'Webhook URL must be a public HTTPS endpoint.' },
          { status: 400 }
        )
      }
      data.webhookUrl = trimmedWebhookUrl || null
    }

    if (instapayPaymentUrl !== undefined) {
      const trimmedPaymentUrl = instapayPaymentUrl ? String(instapayPaymentUrl).trim() : ''
      try {
        data.instapayPaymentUrl = trimmedPaymentUrl ? normalizeInstaPayPaymentUrl(trimmedPaymentUrl) : null
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid InstaPay payment URL.'
        return NextResponse.json({ ok: false, error: message }, { status: 400 })
      }
    }

    if (checkoutTtlMin !== undefined) {
      const ttl = Number(checkoutTtlMin)
      if (Number.isInteger(ttl) && ttl >= 1 && ttl <= 180) {
        data.checkoutTtlMin = ttl
      }
    }

    if (regenerateWebhookSecret) {
      const webhookSecret = generateSecureToken('sec')
      data.webhookSecret = webhookSecret
      data.webhookSecretHash = hashSecret(webhookSecret)
    }

    if (regenerateApiKey) {
      const apiKey = generateSecureToken('ipk')
      data.apiKey = apiKey
      data.apiKeyHash = hashSecret(apiKey)
    }

    if (regenerateDetectToken) {
      const detectToken = generateSecureToken('det')
      data.detectToken = detectToken
      data.detectTokenHash = hashSecret(detectToken)
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
        slug: updated.slug,
        businessName: updated.businessName,
        businessType: updated.businessType,
        instapayHandle: updated.instapayHandle,
        instapayPaymentUrl: updated.instapayPaymentUrl,
        email: updated.email,
        apiKey: updated.apiKey,
        detectToken: updated.detectToken,
        webhookUrl: updated.webhookUrl,
        webhookSecret: updated.webhookSecret,
        checkoutTtlMin: updated.checkoutTtlMin,
        createdAt: updated.createdAt.toISOString(),
        subscriptionPlan: updated.subscriptionPlan,
        subscriptionEndsAt: updated.subscriptionEndsAt ? updated.subscriptionEndsAt.toISOString() : null,
        isFreeTrial: updated.isFreeTrial,
        txLimit: updated.txLimit,
        txCount: updated.txCount,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to update settings: ${message}` }, { status: 500 })
  }
}
