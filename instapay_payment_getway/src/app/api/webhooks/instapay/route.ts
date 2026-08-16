import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMerchantConfig } from '@/lib/merchant'

/**
 * Webhook invoked by the companion Android app (InstaPay Detector).
 *
 * The Android app uses NotificationListenerService to capture notifications
 * posted by com.egyptianbanks.instapay, parses the body text
 * "You have received X.XX EGP from <local>@instapay", and POSTs the parsed
 * fields here. We match against the oldest PENDING checkout whose
 * senderHandle and amountEgp both match, mark it CONFIRMED, and emit a
 * WebSocket event so the waiting client's screen flips instantly.
 *
 * Authentication: shared bearer token in the Authorization header.
 * The token is configured via the DETECT_TOKEN env var on the gateway
 * and must be entered into the Android app's settings screen.
 */

interface WebhookBody {
  /** Amount in EGP as a number (e.g. 1.00). */
  amountEgp?: number
  /** Sender handle as it appeared in the notification (e.g. "ahmed@instapay"). */
  senderHandle?: string
  /** Optional InstaPay reference code parsed from the notification, if present. */
  reference?: string
  /** Optional ISO timestamp of when the notification was posted. */
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

/** POSTs a payload to the checkout-notifier mini-service so it can push
 *  a real-time update to the waiting client via socket.io. Also broadcasts
 *  to the global "dashboard" room so the merchant's dashboard app (and
 *  the web dashboard tab) receive instant updates.
 *
 * The notifier URL is configurable via the NOTIFIER_URL env var.
 * - Local dev (sandbox): defaults to http://localhost:3003
 * - Render/production: set NOTIFIER_URL to https://your-notifier-service.onrender.com
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
        // Emit to the specific checkout room (for the waiting client)
        ...payload,
        // Also emit to the global dashboard room (for the merchant app)
        broadcast: 'dashboard',
        event: 'payment:confirmed',
        dashboardPayload: {
          sessionId: payload.sessionId,
          status: payload.status,
          amountEgp: payload.amountEgp,
          senderHandle: payload.senderHandle,
          detectedRef: payload.detectedRef,
          detectedAt: payload.detectedAt,
        },
      }),
    })
  } catch (err) {
    // The mini-service might be temporarily down — the client's polling
    // fallback will still pick up the status change within 2 seconds.
    console.warn('[webhook] failed to emit WebSocket update:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = getMerchantConfig()

    // --- Auth ---
    if (!config.detectToken) {
      return NextResponse.json(
        { ok: false, error: 'Server is missing DETECT_TOKEN configuration.' },
        { status: 500 }
      )
    }
    const authHeader = request.headers.get('authorization') || ''
    const providedToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''
    if (!providedToken || providedToken !== config.detectToken) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized.' },
        { status: 401 }
      )
    }

    // --- Parse body ---
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
    if (senderHandle === config.handle) {
      return NextResponse.json(
        { ok: false, error: 'Sender equals the merchant handle.' },
        { status: 400 }
      )
    }

    // --- Match against the oldest PENDING checkout with the same
    //     senderHandle + amountEgp that has not expired yet. ---
    const now = new Date()
    const match = await db.transaction.findFirst({
      where: {
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

    const updated = await db.transaction.update({
      where: { id: match.id },
      data: {
        status: 'CONFIRMED',
        detectedRef: reference,
        detectedAt: now,
      },
    })

    // Push a real-time update to the waiting client via WebSocket.
    // Executed asynchronously so the webhook response returns immediately (<10ms).
    void emitCheckoutUpdate({
      sessionId: updated.sessionId,
      status: 'CONFIRMED',
      amountEgp: updated.amountEgp,
      senderHandle: updated.senderHandle,
      detectedRef: updated.detectedRef,
      detectedAt: updated.detectedAt?.toISOString() ?? null,
    })

    return NextResponse.json({
      ok: true,
      matched: true,
      checkout: {
        sessionId: updated.sessionId,
        senderHandle: updated.senderHandle,
        recipientHandle: updated.recipientHandle,
        amountEgp: updated.amountEgp,
        currency: updated.currency,
        status: updated.status,
        detectedRef: updated.detectedRef,
        detectedAt: updated.detectedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        expiresAt: updated.expiresAt.toISOString(),
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

/** Reject non-POST methods — this endpoint is write-only. */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}
