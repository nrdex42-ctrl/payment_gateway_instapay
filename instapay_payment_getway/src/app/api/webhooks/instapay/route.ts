import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByDetectToken, signPayload } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'

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
export async function emitCheckoutUpdate(payload: {
  sessionId: string,
  status: 'CONFIRMED' | 'EXPIRED',
  amountEgp?: number,
  senderHandle?: string,
  detectedRef?: string | null,
  detectedAt?: string | null,
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
export async function forwardToClientWebhook(
  clientId: string,
  url: string,
  secret: string | null,
  payload: Record<string, unknown>
) {
  let statusCode: number | null = null
  let responseText = ''
  let isSuccess = false

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

    statusCode = res.status
    isSuccess = res.ok
    responseText = (await res.text()).slice(0, 1000)

    if (!res.ok) {
      console.warn(`[webhook] client endpoint returned non-OK status: ${res.status}`)
    }
  } catch (err) {
    responseText = err instanceof Error ? err.message : 'Connection failed'
    console.error('[webhook] failed to forward to client webhook:', err)
  } finally {
    try {
      await db.webhookLog.create({
        data: {
          clientId,
          url,
          event: (payload.event as string) || 'payment.confirmed',
          payload: JSON.stringify(payload),
          statusCode,
          response: responseText,
          isSuccess,
        }
      })
    } catch (dbErr) {
      console.error('[webhook] failed to save WebhookLog to DB:', dbErr)
    }
  }
}

export async function POST(request: NextRequest) {
  // Enforce Rate Limit: max 120 detector reports per 1 minute
  const rl = checkRateLimit(request, 120, 60 * 1000)
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: 'Too many notification reports. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    )
  }

  try {
    // --- Auth Client APK ---
    const client = await authenticateByDetectToken(request)
    if (!client) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized. Invalid detectToken.' },
        { status: 401 }
      )
    }

    if (client.subscriptionEndsAt && new Date(client.subscriptionEndsAt).getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: 'Payment Required. Your subscription or free trial has ended.' },
        { status: 402 }
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
    let match = await db.transaction.findFirst({
      where: {
        clientId: client.id,
        senderHandle,
        amountEgp: Math.round(amountEgp * 100) / 100,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Fallback 1: match exact amount checkouts that expired within the last 30 minutes grace period
    if (!match) {
      const GRACE_PERIOD_MS = 30 * 60 * 1000 // 30 minutes grace period
      const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MS)

      match = await db.transaction.findFirst({
        where: {
          clientId: client.id,
          senderHandle,
          amountEgp: Math.round(amountEgp * 100) / 100,
          status: { in: ['PENDING', 'EXPIRED'] },
          expiresAt: { gte: graceCutoff },
        },
        orderBy: { createdAt: 'asc' },
      })
    }

    let isMismatchedAmount = false
    const receivedAmountRounded = Math.round(amountEgp * 100) / 100

    // Fallback 2: Hybrid search for checkouts for the same sender handle, ignoring amount
    if (!match) {
      const GRACE_PERIOD_MS = 30 * 60 * 1000
      const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MS)

      match = await db.transaction.findFirst({
        where: {
          clientId: client.id,
          senderHandle,
          status: { in: ['PENDING', 'EXPIRED'] },
          expiresAt: { gte: graceCutoff },
        },
        orderBy: { createdAt: 'asc' },
      })

      if (match) {
        isMismatchedAmount = true
      }
    }

    // If still no match is found, this is an entirely unmatched (orphaned) payment
    if (!match) {
      try {
        await db.mismatchedPayment.create({
          data: {
            clientId: client.id,
            senderHandle,
            amountEgp: receivedAmountRounded,
            reference,
          }
        })
      } catch (err) {
        console.error('[webhook] failed to save mismatched payment to DB:', err)
      }

      const response = NextResponse.json({
        ok: true,
        matched: false,
        reason: 'NO_PENDING_CHECKOUT',
        received: {
          senderHandle,
          amountEgp: receivedAmountRounded,
          reference,
          notificationTimestamp: notificationTimestamp.toISOString(),
        },
      })
      const rlHeaders = getRateLimitHeaders(rl)
      Object.entries(rlHeaders).forEach(([k, v]) => {
        response.headers.set(k, v)
      })
      return response
    }

    // Handle Mismatched Amount logic
    if (isMismatchedAmount) {
      if (receivedAmountRounded < match.amountEgp) {
        // Underpayment: mark transaction as UNDERPAID and save
        const updated = await db.transaction.update({
          where: { id: match.id },
          data: {
            status: 'UNDERPAID',
            detectedRef: reference,
            detectedAt: now,
            detectedAmountEgp: receivedAmountRounded,
          },
        })

        // Trigger callback webhook for underpayment
        if (client.webhookUrl) {
          void forwardToClientWebhook(client.id, client.webhookUrl, client.webhookSecret, {
            event: 'payment.underpaid',
            clientId: client.id,
            businessName: client.businessName,
            transaction: {
              sessionId: updated.sessionId,
              senderHandle: updated.senderHandle,
              recipientHandle: updated.recipientHandle,
              amountEgp: match.amountEgp, // requested amount
              detectedAmountEgp: updated.detectedAmountEgp, // received amount
              currency: updated.currency,
              status: updated.status,
              detectedRef: updated.detectedRef,
              detectedAt: updated.detectedAt?.toISOString() ?? null,
              note: updated.note,
              createdAt: updated.createdAt.toISOString(),
            },
          })
        }

        const response = NextResponse.json({
          ok: true,
          matched: false,
          reason: 'UNDERPAID',
          received: {
            senderHandle,
            amountEgp: receivedAmountRounded,
            reference,
            notificationTimestamp: notificationTimestamp.toISOString(),
          },
        })
        const rlHeaders = getRateLimitHeaders(rl)
        Object.entries(rlHeaders).forEach(([k, v]) => {
          response.headers.set(k, v)
        })
        return response
      } else {
        // Overpayment: confirm transaction and record the actual amount received
        console.log(`[webhook] Overpayment matched! Expected ${match.amountEgp}, got ${receivedAmountRounded}`)
      }
    }

    // Update transaction to CONFIRMED (for exact match or overpayment)
    const updated = await db.transaction.update({
      where: { id: match.id },
      data: {
        status: 'CONFIRMED',
        detectedRef: reference,
        detectedAt: now,
        detectedAmountEgp: receivedAmountRounded,
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
      void forwardToClientWebhook(client.id, client.webhookUrl, client.webhookSecret, {
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

    const response = NextResponse.json({
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
    const rlHeaders = getRateLimitHeaders(rl)
    Object.entries(rlHeaders).forEach(([k, v]) => {
      response.headers.set(k, v)
    })
    return response
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
