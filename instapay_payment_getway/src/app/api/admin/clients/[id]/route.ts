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
    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const { id } = resolvedParams
    const body = await request.json()
    const { businessName, instapayHandle, webhookUrl, checkoutTtlMin, isActive, subscriptionPlan, isFreeTrial, subscriptionEndsAt, txLimit, txCount } = body || {}

    const client = await db.client.findUnique({ where: { id } })
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Client not found.' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (businessName !== undefined) data.businessName = String(businessName).trim()
    if (webhookUrl !== undefined) data.webhookUrl = webhookUrl ? String(webhookUrl).trim() : null
    if (checkoutTtlMin !== undefined) data.checkoutTtlMin = Number(checkoutTtlMin)
    if (isActive !== undefined) data.isActive = Boolean(isActive)
    if (subscriptionPlan !== undefined) data.subscriptionPlan = String(subscriptionPlan).trim()
    if (isFreeTrial !== undefined) data.isFreeTrial = Boolean(isFreeTrial)
    if (txLimit !== undefined) data.txLimit = Number(txLimit)
    if (txCount !== undefined) data.txCount = Number(txCount)
    if (subscriptionEndsAt !== undefined) {
      data.subscriptionEndsAt = subscriptionEndsAt ? new Date(subscriptionEndsAt as string | number) : null
    }

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

    await db.auditLog.create({
      data: {
        action: 'UPDATE_MERCHANT',
        details: `Updated merchant ${updated.businessName} (ID: ${id}). Settings updated: ${JSON.stringify(data)}`,
      }
    }).catch(() => {})

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
    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })
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

    await db.auditLog.create({
      data: {
        action: 'DELETE_MERCHANT',
        details: `Deleted merchant ${client.businessName} (ID: ${id}) and all their associated transactions.`,
      }
    }).catch(() => {})

    return NextResponse.json({ ok: true, message: 'Client deleted successfully.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to delete client: ${message}` }, { status: 500 })
  }
}
