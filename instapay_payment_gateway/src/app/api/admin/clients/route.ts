import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner, generateSecureToken, generateSlug, hashPassword, hashSecret } from '@/lib/auth'
import { normalizeInstaPayPaymentUrl } from '@/lib/merchant'

/**
 * GET: List all clients on the platform (approved, pending, rejected) with summarized stats.
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
    const clients = await db.client.findMany({
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

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
          firstName: client.firstName,
          lastName: client.lastName,
          whatsappNumber: client.whatsappNumber,
          businessName: client.businessName,
          businessType: client.businessType,
          instapayHandle: client.instapayHandle,
          instapayPaymentUrl: client.instapayPaymentUrl,
          email: client.email,
          apiKey: client.apiKey,
          detectToken: client.detectToken,
          webhookUrl: client.webhookUrl,
          isActive: client.isActive,
          approvalStatus: client.approvalStatus,
          checkoutTtlMin: client.checkoutTtlMin,
          createdAt: client.createdAt.toISOString(),
          totalTransactions: client._count.transactions,
          confirmedVolume: confirmedSum._sum.amountEgp ?? 0,
          subscriptionPlan: client.subscriptionPlan,
          subscriptionEndsAt: client.subscriptionEndsAt ? client.subscriptionEndsAt.toISOString() : null,
          isFreeTrial: client.isFreeTrial,
          txLimit: client.txLimit,
          txCount: client.txCount,
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
 * POST: Create/Register a new client directly by Admin (Pre-approved).
 */
export async function POST(request: NextRequest) {
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
    const { businessName, businessType, instapayHandle, instapayPaymentUrl, email, password, webhookUrl, checkoutTtlMin } = body || {}

    if (!businessName?.trim() || !instapayHandle?.trim() || !email?.trim()) {
      return NextResponse.json({ ok: false, error: 'businessName, instapayHandle, and email are required.' }, { status: 400 })
    }

    let handle = instapayHandle.trim().toLowerCase().replace(/^@/, '')
    if (!handle.endsWith('@instapay')) {
      handle = `${handle.split('@')[0]}@instapay`
    }

    const existingEmail = await db.client.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (existingEmail) {
      return NextResponse.json({ ok: false, error: 'Email already registered.' }, { status: 400 })
    }

    let slug = generateSlug(businessName)
    let existingSlug = await db.client.findUnique({ where: { slug } })
    let count = 1
    while (existingSlug) {
      slug = `${generateSlug(businessName)}-${count}`
      existingSlug = await db.client.findUnique({ where: { slug } })
      count++
    }

    const apiKey = generateSecureToken('ipk')
    const detectToken = generateSecureToken('det')
    
    // Hash password (or default password for admin-created clients)
    const generatedPassword = password?.trim() || Math.random().toString(36).slice(-8)
    const passwordHash = hashPassword(generatedPassword)

    const client = await db.client.create({
      data: {
        slug,
        businessName: businessName.trim(),
        businessType: businessType ? String(businessType).trim().slice(0, 80) : null,
        instapayHandle: handle,
        instapayPaymentUrl: instapayPaymentUrl ? normalizeInstaPayPaymentUrl(String(instapayPaymentUrl)) : null,
        email: email.trim().toLowerCase(),
        passwordHash,
        apiKey,
        detectToken,
        apiKeyHash: hashSecret(apiKey),
        detectTokenHash: hashSecret(detectToken),
        webhookUrl: webhookUrl?.trim() || null,
        checkoutTtlMin: Number(checkoutTtlMin || 10),
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    })

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        slug: client.slug,
        businessName: client.businessName,
        businessType: client.businessType,
        instapayHandle: client.instapayHandle,
        instapayPaymentUrl: client.instapayPaymentUrl,
        email: client.email,
        apiKey: client.apiKey,
        detectToken: client.detectToken,
        webhookUrl: client.webhookUrl,
        checkoutTtlMin: client.checkoutTtlMin,
        isActive: client.isActive,
        approvalStatus: client.approvalStatus,
        password: generatedPassword, // return the generated password
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to create client: ${message}` }, { status: 500 })
  }
}
