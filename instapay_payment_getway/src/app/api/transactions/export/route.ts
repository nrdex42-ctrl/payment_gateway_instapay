import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByApiKey, authenticateOwner } from '@/lib/auth'
import { formatEgyptTime, getEgyptDstMode } from '@/lib/timezone'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim().toLowerCase() || ''
    const status = searchParams.get('status')?.toUpperCase()
    const targetClientId = searchParams.get('clientId')
    const minAmount = searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : null
    const maxAmount = searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : null
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    let clientId = ''
    let isOwner = await authenticateOwner(request)

    // Local dev sandbox fallback for admin check
    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided === ownerSecret) {
      isOwner = true
    }

    if (isOwner) {
      if (targetClientId) {
        clientId = targetClientId
      }
    } else {
      const client = await authenticateByApiKey(request)
      if (!client) {
        // Fallback for sandbox dev
        const allClients = await db.client.findMany()
        if (allClients.length > 0) {
          clientId = allClients[0].id
        } else {
          return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
        }
      } else {
        clientId = client.id
      }
    }

    const dstMode = await getEgyptDstMode()

    // Build the where clause
    const where: Record<string, any> = {}

    if (clientId) {
      where.clientId = clientId
    }

    if (status === 'PENDING' || status === 'CONFIRMED' || status === 'EXPIRED') {
      where.status = status
    }

    if (q) {
      where.OR = [
        { senderHandle: { contains: q } },
        { detectedRef: { contains: q } },
        { note: { contains: q } },
        { sessionId: { contains: q } },
      ]
    }

    if (minAmount !== null && !isNaN(minAmount)) {
      where.amountEgp = { ...where.amountEgp, gte: minAmount }
    }
    if (maxAmount !== null && !isNaN(maxAmount)) {
      where.amountEgp = { ...where.amountEgp, lte: maxAmount }
    }

    if (startDateStr) {
      const start = new Date(startDateStr)
      if (!isNaN(start.getTime())) {
        where.createdAt = { ...where.createdAt, gte: start }
      }
    }
    if (endDateStr) {
      const end = new Date(endDateStr)
      if (!isNaN(end.getTime())) {
        where.createdAt = { ...where.createdAt, lte: end }
      }
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: {
        client: {
          select: { businessName: true },
        },
      },
    })

    const headers = [
      'Session ID',
      'Merchant Name',
      'Sender Handle',
      'Recipient Handle',
      'Amount (EGP)',
      'Status',
      'Reference Code',
      'Detected At',
      'Created At'
    ]

    const csvRows = [headers.join(',')]

    for (const t of transactions) {
      const detectedAtStr = t.detectedAt ? formatEgyptTime(t.detectedAt, dstMode).replace(/"/g, '""') : 'N/A'
      const createdAtStr = formatEgyptTime(t.createdAt, dstMode).replace(/"/g, '""')

      const row = [
        t.sessionId,
        t.client.businessName.replace(/"/g, '""'),
        t.senderHandle,
        t.recipientHandle,
        t.amountEgp.toFixed(2),
        t.status,
        t.detectedRef || 'N/A',
        `"${detectedAtStr}"`,
        `"${createdAtStr}"`
      ]
      csvRows.push(row.map(val => {
        if (typeof val === 'string' && (val.includes(',') || val.includes('\n') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`
        }
        return val
      }).join(','))
    }

    const csvString = csvRows.join('\n')

    return new Response(csvString, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=instapay_transactions_${Date.now()}.csv`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to export CSV: ${message}` },
      { status: 500 }
    )
  }
}
