import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'
import { sendMerchantNotificationEmail } from '@/lib/emailDelivery'

export async function POST(request: NextRequest) {
  if (!(await authenticateOwner(request))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const rawTarget = String(body?.clientId || body?.target || '').trim()
    const clientIds: string[] = Array.isArray(body?.clientIds) ? body.clientIds : []
    const title = String(body?.title || '').trim()
    const message = String(body?.message || '').trim()
    const severity = String(body?.severity || 'INFO').toUpperCase()
    const channel = String(body?.channel || body?.deliveryMethod || 'BOTH').toUpperCase()

    if (!title || !message) {
      return NextResponse.json({ ok: false, error: 'Title and message are required.' }, { status: 400 })
    }

    if (!['INFO', 'SUCCESS', 'WARNING', 'URGENT'].includes(severity)) {
      return NextResponse.json({ ok: false, error: 'Invalid notification severity.' }, { status: 400 })
    }

    if (!['DETECTOR', 'EMAIL', 'BOTH', 'APP'].includes(channel)) {
      return NextResponse.json({ ok: false, error: 'Invalid notification channel.' }, { status: 400 })
    }

    const sendToInApp = channel === 'DETECTOR' || channel === 'APP' || channel === 'BOTH'
    const sendToEmail = channel === 'EMAIL' || channel === 'BOTH'

    // Determine target clients
    let targetClients: Array<{ id: string; email: string; businessName: string }> = []

    if (rawTarget === 'ALL' || (rawTarget === '' && clientIds.length === 0)) {
      // Send to all approved/active merchants
      targetClients = await db.client.findMany({
        select: { id: true, email: true, businessName: true },
        where: { approvalStatus: 'APPROVED' },
      })
    } else if (clientIds.length > 0) {
      targetClients = await db.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, email: true, businessName: true },
      })
    } else {
      const client = await db.client.findUnique({
        where: { id: rawTarget },
        select: { id: true, email: true, businessName: true },
      })
      if (!client) {
        return NextResponse.json({ ok: false, error: 'Merchant not found.' }, { status: 404 })
      }
      targetClients = [client]
    }

    if (targetClients.length === 0) {
      return NextResponse.json({ ok: false, error: 'No matching merchants found to notify.' }, { status: 404 })
    }

    let inAppCount = 0
    let emailCount = 0

    // 1. Create In-App notifications for targeted merchants
    if (sendToInApp) {
      await db.merchantNotification.createMany({
        data: targetClients.map((c) => ({
          clientId: c.id,
          title: title.slice(0, 120),
          message: message.slice(0, 2000),
          severity,
        })),
      })
      inAppCount = targetClients.length
    }

    // 2. Dispatch emails in background if requested
    if (sendToEmail) {
      const emailPromises = targetClients.map(async (c) => {
        try {
          const sent = await sendMerchantNotificationEmail({
            to: c.email,
            businessName: c.businessName,
            title,
            message,
            severity,
          })
          if (sent) emailCount++
        } catch (err) {
          console.warn(`[admin-notifications] Failed to send email to ${c.email}:`, err)
        }
      })
      await Promise.allSettled(emailPromises)
    }

    // Log admin audit action
    await db.auditLog.create({
      data: {
        action: 'SEND_NOTIFICATION',
        details: `Dispatched "${title}" (${severity}) via ${channel} to ${targetClients.length} merchant(s)`,
      },
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      count: targetClients.length,
      inAppDelivered: inAppCount,
      emailDelivered: emailCount,
      channel,
      message: `Notification sent to ${targetClients.length} merchant(s) via ${channel.toLowerCase()}.`,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to send notification.' },
      { status: 500 }
    )
  }
}

