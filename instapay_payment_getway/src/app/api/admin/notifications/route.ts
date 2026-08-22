import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'

export async function POST(request: NextRequest) {
  if (!await authenticateOwner(request)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await request.json()
    const clientId = String(body?.clientId || '').trim()
    const title = String(body?.title || '').trim()
    const message = String(body?.message || '').trim()
    const severity = String(body?.severity || 'INFO').toUpperCase()
    if (!clientId || !title || !message) return NextResponse.json({ ok: false, error: 'Merchant, title, and message are required.' }, { status: 400 })
    if (!['INFO', 'SUCCESS', 'WARNING', 'URGENT'].includes(severity)) return NextResponse.json({ ok: false, error: 'Invalid notification severity.' }, { status: 400 })
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } })
    if (!client) return NextResponse.json({ ok: false, error: 'Merchant not found.' }, { status: 404 })
    const notification = await db.merchantNotification.create({ data: { clientId, title: title.slice(0, 120), message: message.slice(0, 2000), severity } })
    return NextResponse.json({ ok: true, notification })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to send notification.' }, { status: 500 })
  }
}
