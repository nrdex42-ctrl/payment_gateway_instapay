import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'
import { emitCheckoutUpdate, forwardToClientWebhook } from '@/app/api/webhooks/instapay/route'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const isOwner = await authenticateOwner(request)
  const { sessionId } = await params

  if (!isOwner) {
    const ownerSecret = process.env.OWNER_SECRET || 'owner-sandbox-secret-token-2026'
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const transaction = await db.transaction.findUnique({
      where: { sessionId },
      include: {
        client: {
          select: {
            id: true,
            businessName: true,
            webhookUrl: true,
            webhookSecret: true,
          },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json({ ok: false, error: 'Transaction not found.' }, { status: 404 })
    }

    if (transaction.status !== 'PENDING') {
      return NextResponse.json(
        { ok: false, error: `Transaction is already in ${transaction.status} status.` },
        { status: 400 }
      )
    }

    const now = new Date()

    // 1. Update status to CONFIRMED
    const updated = await db.transaction.update({
      where: { sessionId },
      data: {
        status: 'CONFIRMED',
        detectedRef: 'MANUAL_BY_ADMIN',
        detectedAt: now,
      },
    })

    // 2. Create Audit Log entry
    await db.auditLog.create({
      data: {
        action: 'FORCE_CONFIRM',
        details: `Manually confirmed checkout session ${sessionId} for merchant: ${transaction.client.businessName} (Amount: ${transaction.amountEgp} EGP)`,
      },
    }).catch(() => {})

    // 3. Emit real-time WebSocket update
    void emitCheckoutUpdate({
      sessionId: updated.sessionId,
      status: 'CONFIRMED',
      amountEgp: updated.amountEgp,
      senderHandle: updated.senderHandle,
      detectedRef: updated.detectedRef,
      detectedAt: updated.detectedAt?.toISOString() ?? null,
    })

    // 4. Forward webhook callback if configured
    if (transaction.client.webhookUrl) {
      void forwardToClientWebhook(
        transaction.client.id,
        transaction.client.webhookUrl,
        transaction.client.webhookSecret,
        {
          event: 'payment.confirmed',
          clientId: transaction.client.id,
          businessName: transaction.client.businessName,
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
        }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Transaction successfully force-confirmed.',
      transaction: {
        sessionId: updated.sessionId,
        status: updated.status,
        amountEgp: updated.amountEgp,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to force confirm transaction: ${message}` },
      { status: 500 }
    )
  }
}
