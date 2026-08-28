import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionClient } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const client = await getSessionClient(request)
  if (!client) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const notifications = await db.merchantNotification.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' }, take: 30 })
  return NextResponse.json({ ok: true, notifications })
}

export async function PATCH(request: NextRequest) {
  const client = await getSessionClient(request)
  if (!client) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const body = await request.json()
  const id = String(body?.id || '').trim()
  if (!id) return NextResponse.json({ ok: false, error: 'Notification id is required.' }, { status: 400 })
  await db.merchantNotification.updateMany({ where: { id, clientId: client.id }, data: { readAt: new Date() } })
  return NextResponse.json({ ok: true })
}
