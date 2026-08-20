import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'

/**
 * GET: List all subscription plans (Admin version)
 */
export async function GET(request: NextRequest) {
  const isOwner = await authenticateOwner(request)
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
    const plans = await db.plan.findMany({
      orderBy: { priceEgp: 'asc' }
    })
    return NextResponse.json({ ok: true, plans })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to fetch plans: ${message}` }, { status: 500 })
  }
}

/**
 * PATCH: Update pricing or transaction limits for a subscription plan.
 */
export async function PATCH(request: NextRequest) {
  const isOwner = await authenticateOwner(request)
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
    const body = await request.json()
    const { name, priceEgp, maxTransactions } = body || {}

    if (!name) {
      return NextResponse.json({ ok: false, error: 'Plan name is required.' }, { status: 400 })
    }

    const plan = await db.plan.findUnique({ where: { name } })
    if (!plan) {
      return NextResponse.json({ ok: false, error: `Plan '${name}' not found.` }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (priceEgp !== undefined) data.priceEgp = Number(priceEgp)
    if (maxTransactions !== undefined) data.maxTransactions = Number(maxTransactions)

    const updated = await db.plan.update({
      where: { name },
      data,
    })

    await db.auditLog.create({
      data: {
        action: 'UPDATE_PLAN_PRICING',
        details: `Updated subscription plan '${name}'. Data updated: ${JSON.stringify(data)}`,
      }
    }).catch(() => {})

    return NextResponse.json({ ok: true, plan: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to update plan: ${message}` }, { status: 500 })
  }
}
