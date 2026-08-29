import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateByApiKey, authenticateByDetectToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const client = await authenticateByApiKey(request) ?? await authenticateByDetectToken(request)
  if (!client) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const notifications = await db.merchantNotification.findMany({ where: { clientId: client.id, readAt: null }, orderBy: { createdAt: 'asc' }, take: 20 })
  return NextResponse.json({ ok: true, notifications })
}

export async function PATCH(request: NextRequest) {
  const client = await authenticateByApiKey(request) ?? await authenticateByDetectToken(request)
  if (!client) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const body = await request.json()
  const ids = Array.isArray(body?.ids) ? body.ids.map(String).slice(0, 50) : []
  if (ids.length) await db.merchantNotification.updateMany({ where: { clientId: client.id, id: { in: ids } }, data: { readAt: new Date() } })
  return NextResponse.json({ ok: true })
}
