import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByDetectToken, signPayload } from '@/lib/auth'

interface WebhookBody {
  amountEgp?: number
  senderHandle?: string
  reference?: string
  notificationTimestamp?: string
}

function normalizeHandle(raw: string): string {
  let h = (raw || '').trim().toLowerCase().replace(/^@/, '')
  if (!h) return ''
  const local = h.split('@')[0]
  if (!local) return ''
  return `${local}@instapay`
}

function extractSenderFromText(text: string): string | null {
  const match = text
    .toLowerCase()
    .match(/received\s+[\d.,]+\s*egp?\s+from\s+([a-z0-9_.\-]+@instapay)/)
  if (!match) return null
  return match[1]
}

function extractAmountFromText(text: string): number | null {
  const match = text
    .toLowerCase()
    .match(/received\s+([\d]+(?:\.[\d]{1,2})?)\s*egp?\b/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Notify the waiting client screen via real-time WebSocket connection.
 */
async function emitCheckoutUpdate(payload: {
  sessionId: string
  status: 'CONFIRMED' | 'EXPIRED'
  amountEgp?: number
  senderHandle?: string
  detectedRef?: string | null
  detectedAt?: string | null
}) {
  const notifierUrl = process.env.NOTIFIER_URL || 'http://localhost:3003'
  try {
    await fetch(`${notifierUrl}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        broadcast: 'dashboard',
        event: 'payment:confirmed',
        dashboardPayload: payload,
      }),
    })
  } catch (err) {
    console.warn('[webhook] failed to emit WebSocket update:', err)
  }
}

/**
 * Optional Callback to Client's Server Webhook Endpoint.
 */
async function forwardToClientWebhook(
  url: string,
  secret: string | null,
  payload: Record<string, unknown>
) {
  try {
    const bodyStr = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Instapay-Detector-Gateway/2.0',
    }

    if (secret) {
      const signature = await signPayload(bodyStr, secret)
      headers['X-Instapay-Signature'] = signature
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyStr,
    })

    if (!res.ok) {
      console.warn(`[webhook] client endpoint returned non-OK status: ${res.status}`)
    }
  } catch (err) {
    console.error('[webhook] failed to forward to client webhook:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    // --- Auth Client APK ---
    const client = await authenticateByDetectToken(request)
    if (!client) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized. Invalid detectToken.' },
        { status: 401 }
      )
    }

    // --- Parse incoming payload ---
    const body = (await request.json()) as WebhookBody

    let amountEgp: number | null = body.amountEgp != null ? Number(body.amountEgp) : null
    let senderHandle: string | null = body.senderHandle
      ? normalizeHandle(body.senderHandle)
      : null

    const rawText = (body as { text?: string }).text
    if (rawText) {
      const extractedSender = extractSenderFromText(rawText)
      senderHandle = senderHandle || (extractedSender ? normalizeHandle(extractedSender) : null)
      amountEgp = amountEgp ?? extractAmountFromText(rawText)
    }

    const reference = (body.reference || '').trim() || null
    const notificationTimestamp = body.notificationTimestamp
      ? new Date(body.notificationTimestamp)
      : new Date()

    if (amountEgp == null || !Number.isFinite(amountEgp) || amountEgp <= 0) {
      return NextResponse.json(
        { ok: false, error: 'amountEgp is required and must be a positive number.' },
        { status: 400 }
      )
    }
    if (!senderHandle) {
      return NextResponse.json(
        { ok: false, error: 'senderHandle is required (e.g. "ahmed@instapay").' },
        { status: 400 }
      )
    }

    // Sanity check: cannot pay yourself
    if (senderHandle === client.instapayHandle) {
      return NextResponse.json(
        { ok: false, error: 'Sender equals client/recipient handle.' },
        { status: 400 }
      )
    }

    // --- Match PENDING checkouts for this client only ---
    const now = new Date()
    const match = await db.transaction.findFirst({
      where: {
        clientId: client.id,
        senderHandle,
        amountEgp: Math.round(amountEgp * 100) / 100,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!match) {
      return NextResponse.json({
        ok: true,
        matched: false,
        reason: 'NO_PENDING_CHECKOUT',
        received: {
          senderHandle,
          amountEgp: Math.round(amountEgp * 100) / 100,
          reference,
          notificationTimestamp: notificationTimestamp.toISOString(),
        },
      })
    }

    // Update transaction to CONFIRMED
    const updated = await db.transaction.update({
      where: { id: match.id },
      data: {
        status: 'CONFIRMED',
        detectedRef: reference,
        detectedAt: now,
      },
    })

    // Push WebSocket real-time update to checkout waiting screen
    void emitCheckoutUpdate({
      sessionId: updated.sessionId,
      status: 'CONFIRMED',
      amountEgp: updated.amountEgp,
      senderHandle: updated.senderHandle,
      detectedRef: updated.detectedRef,
      detectedAt: updated.detectedAt?.toISOString() ?? null,
    })

    // If client has custom callback webhook, trigger it
    if (client.webhookUrl) {
      void forwardToClientWebhook(client.webhookUrl, client.webhookSecret, {
        event: 'payment.confirmed',
        clientId: client.id,
        businessName: client.businessName,
        transaction: {
          sessionId: updated.sessionId,
          senderHandle: updated.senderHandle,
          recipientHandle: updated.recipientHandle,
          amountEgp: updated.amountEgp,
          currency: updated.currency,
          status: updated.status,
          detectedRef: updated.detectedRef,
          detectedAt: updated.detectedAt?.toISOString() ?? null,
          note: updated.note,
          createdAt: updated.createdAt.toISOString(),
        },
      })
    }

    return NextResponse.json({
      ok: true,
      matched: true,
      checkout: {
        sessionId: updated.sessionId,
        senderHandle: updated.senderHandle,
        recipientHandle: updated.recipientHandle,
        amountEgp: updated.amountEgp,
        status: updated.status,
        detectedRef: updated.detectedRef,
        detectedAt: updated.detectedAt?.toISOString() ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Webhook failed: ${message}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}
