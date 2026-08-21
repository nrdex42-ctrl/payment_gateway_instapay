import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByDetectToken } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'
import { forwardToClientWebhook } from '@/lib/webhook'
import { toEgpCents, fromEgpCents, egpAmountFromRow } from '@/lib/money'

interface WebhookBody {
  amountEgp?: number
  senderHandle?: string
  reference?: string
  notificationTimestamp?: string
  deviceId?: string
  appVersion?: string
  androidVersion?: string
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
  detectedAmountEgp?: number | null,
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
    const requestIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

    if (body.deviceId?.trim()) {
      await db.detectorDevice.upsert({
        where: {
          clientId_deviceId: {
            clientId: client.id,
            deviceId: body.deviceId.trim().slice(0, 128),
          },
        },
        create: {
          clientId: client.id,
          deviceId: body.deviceId.trim().slice(0, 128),
          appVersion: body.appVersion?.trim().slice(0, 64) || null,
          androidVersion: body.androidVersion?.trim().slice(0, 64) || null,
          lastIp: requestIp,
        },
        update: {
          appVersion: body.appVersion?.trim().slice(0, 64) || undefined,
          androidVersion: body.androidVersion?.trim().slice(0, 64) || undefined,
          lastIp: requestIp,
          lastSeenAt: new Date(),
        },
      }).catch((err) => {
        console.error('[webhook] failed to upsert detector device heartbeat:', err)
      })
    }

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
    const receivedAmountCents = toEgpCents(amountEgp)
    const receivedAmountRounded = fromEgpCents(receivedAmountCents) ?? 0
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
        amountCents: receivedAmountCents,
        amountEgp: receivedAmountRounded,
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
          amountCents: receivedAmountCents,
          amountEgp: receivedAmountRounded,
          status: { in: ['PENDING', 'EXPIRED'] },
          expiresAt: { gte: graceCutoff },
        },
        orderBy: { createdAt: 'asc' },
      })
    }

    let isMismatchedAmount = false
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
            amountCents: receivedAmountCents,
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
      const requestedAmountCents = match.amountCents ?? toEgpCents(match.amountEgp)
      if (receivedAmountCents < requestedAmountCents) {
        // Underpayment: mark transaction as UNDERPAID and save
        const updated = await db.transaction.update({
          where: { id: match.id },
          data: {
            status: 'UNDERPAID',
            detectedRef: reference,
            detectedAt: now,
            detectedAmountEgp: receivedAmountRounded,
            detectedAmountCents: receivedAmountCents,
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
              amountEgp: egpAmountFromRow(match), // requested amount
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

    // Update transaction to CONFIRMED (for exact match or overpayment). The status
    // predicate makes duplicate detector notifications idempotent.
    const confirmed = await db.transaction.updateMany({
      where: { id: match.id, status: { in: ['PENDING', 'EXPIRED'] } },
      data: {
        status: 'CONFIRMED',
        detectedRef: reference,
        detectedAt: now,
        detectedAmountEgp: receivedAmountRounded,
        detectedAmountCents: receivedAmountCents,
      },
    })

    if (confirmed.count === 0) {
      return NextResponse.json({
        ok: true,
        matched: true,
        duplicate: true,
        checkout: {
          sessionId: match.sessionId,
          status: match.status,
        },
      })
    }

    const updated = await db.transaction.findUniqueOrThrow({
      where: { id: match.id },
    })

    // Increment client's confirmed transaction count atomically
    await db.client.update({
      where: { id: client.id },
      data: {
        txCount: {
          increment: 1,
        },
      },
    }).catch((err) => {
      console.error('[webhook] Failed to increment client txCount:', err)
    })

    // Push WebSocket real-time update to checkout waiting screen
    void emitCheckoutUpdate({
      sessionId: updated.sessionId,
      status: 'CONFIRMED',
      amountEgp: updated.amountEgp,
      detectedAmountEgp: updated.detectedAmountEgp,
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
          detectedAmountEgp: updated.detectedAmountEgp,
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
        detectedAmountEgp: updated.detectedAmountEgp,
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
