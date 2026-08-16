import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'

/**
 * PATCH: Update an existing client.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isOwner = await authenticateOwner(request)
  const resolvedParams = await params
  if (!isOwner) {
    const ownerSecret = process.env.OWNER_SECRET || 'owner-sandbox-secret-token-2026'
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const { id } = resolvedParams
    const body = await request.json()
    const { businessName, instapayHandle, webhookUrl, checkoutTtlMin, isActive } = body || {}

    const client = await db.client.findUnique({ where: { id } })
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Client not found.' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (businessName !== undefined) data.businessName = String(businessName).trim()
    if (webhookUrl !== undefined) data.webhookUrl = webhookUrl ? String(webhookUrl).trim() : null
    if (checkoutTtlMin !== undefined) data.checkoutTtlMin = Number(checkoutTtlMin)
    if (isActive !== undefined) data.isActive = Boolean(isActive)

    if (instapayHandle !== undefined) {
      let handle = String(instapayHandle).trim().toLowerCase().replace(/^@/, '')
      if (handle) {
        if (!handle.endsWith('@instapay')) {
          handle = `${handle.split('@')[0]}@instapay`
        }
        data.instapayHandle = handle
      }
    }

    const updated = await db.client.update({
      where: { id },
      data,
    })

    return NextResponse.json({ ok: true, client: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to update client: ${message}` }, { status: 500 })
  }
}

/**
 * DELETE: Remove a client.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isOwner = await authenticateOwner(request)
  const resolvedParams = await params
  if (!isOwner) {
    const ownerSecret = process.env.OWNER_SECRET || 'owner-sandbox-secret-token-2026'
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const { id } = resolvedParams
    const client = await db.client.findUnique({ where: { id } })
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Client not found.' }, { status: 404 })
    }

    // Cascade delete transactions first (or Prisma will fail if foreign keys are enforced)
    await db.transaction.deleteMany({
      where: { clientId: id },
    })

    await db.client.delete({
      where: { id },
    })

    return NextResponse.json({ ok: true, message: 'Client deleted successfully.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to delete client: ${message}` }, { status: 500 })
  }
}
