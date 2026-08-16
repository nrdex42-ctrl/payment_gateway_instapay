import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner, generateSecureToken, generateSlug } from '@/lib/auth'

/**
 * GET: List all clients on the platform with summarized stats.
 */
export async function GET(request: NextRequest) {
  const isOwner = await authenticateOwner(request)
  if (!isOwner) {
    // Also support fallback local check if OWNER_SECRET is unset during sandbox dev
    const ownerSecret = process.env.OWNER_SECRET || 'owner-sandbox-secret-token-2026'
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const clients = await db.client.findMany({
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get aggregated confirmed amount for each client
    const clientStats = await Promise.all(
      clients.map(async (client) => {
        const confirmedSum = await db.transaction.aggregate({
          _sum: { amountEgp: true },
          where: {
            clientId: client.id,
            status: 'CONFIRMED',
          },
        })

        return {
          id: client.id,
          slug: client.slug,
          businessName: client.businessName,
          instapayHandle: client.instapayHandle,
          apiKey: client.apiKey,
          detectToken: client.detectToken,
          webhookUrl: client.webhookUrl,
          isActive: client.isActive,
          checkoutTtlMin: client.checkoutTtlMin,
          createdAt: client.createdAt.toISOString(),
          totalTransactions: client._count.transactions,
          confirmedVolume: confirmedSum._sum.amountEgp ?? 0,
        }
      })
    )

    return NextResponse.json({ ok: true, clients: clientStats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to load clients: ${message}` }, { status: 500 })
  }
}

/**
 * POST: Create a new client.
 */
export async function POST(request: NextRequest) {
  const isOwner = await authenticateOwner(request)
  if (!isOwner) {
    const ownerSecret = process.env.OWNER_SECRET || 'owner-sandbox-secret-token-2026'
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const body = await request.json()
    const { businessName, instapayHandle, webhookUrl, checkoutTtlMin } = body || {}

    if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
      return NextResponse.json({ ok: false, error: 'businessName is required.' }, { status: 400 })
    }

    if (!instapayHandle || typeof instapayHandle !== 'string' || !instapayHandle.trim()) {
      return NextResponse.json({ ok: false, error: 'instapayHandle is required.' }, { status: 400 })
    }

    // Clean and normalize handle
    let handle = instapayHandle.trim().toLowerCase().replace(/^@/, '')
    if (!handle.endsWith('@instapay')) {
      handle = `${handle.split('@')[0]}@instapay`
    }

    let slug = generateSlug(businessName)
    // Avoid slug collisions
    let existing = await db.client.findUnique({ where: { slug } })
    let count = 1
    while (existing) {
      slug = `${generateSlug(businessName)}-${count}`
      existing = await db.client.findUnique({ where: { slug } })
      count++
    }

    const apiKey = generateSecureToken('ipk')
    const detectToken = generateSecureToken('det')

    const client = await db.client.create({
      data: {
        slug,
        businessName: businessName.trim(),
        instapayHandle: handle,
        apiKey,
        detectToken,
        webhookUrl: webhookUrl?.trim() || null,
        checkoutTtlMin: Number(checkoutTtlMin || 10),
        isActive: true,
      },
    })

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        slug: client.slug,
        businessName: client.businessName,
        instapayHandle: client.instapayHandle,
        apiKey: client.apiKey,
        detectToken: client.detectToken,
        webhookUrl: client.webhookUrl,
        checkoutTtlMin: client.checkoutTtlMin,
        isActive: client.isActive,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to create client: ${message}` }, { status: 500 })
  }
}
