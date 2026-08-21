import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner, generateSecureToken, hashSecret } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ ok: false, error: 'Client account not found.' }, { status: 404 })
    }

    if (client.approvalStatus === 'APPROVED') {
      return NextResponse.json({ ok: false, error: 'Client account is already approved.' }, { status: 400 })
    }

    // Generate keys only after approval
    const apiKey = generateSecureToken('ipk')
    const detectToken = generateSecureToken('det')

    const updated = await db.client.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        isActive: true,
        apiKey,
        detectToken,
        apiKeyHash: hashSecret(apiKey),
        detectTokenHash: hashSecret(detectToken),
      },
    })

    await db.auditLog.create({
      data: {
        action: 'APPROVE_MERCHANT',
        details: `Approved merchant: ${updated.businessName} (ID: ${updated.id})`,
      }
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      message: `Merchant account approved successfully.`,
      client: {
        id: updated.id,
        businessName: updated.businessName,
        apiKey: updated.apiKey,
        detectToken: updated.detectToken,
        approvalStatus: updated.approvalStatus,
        isActive: updated.isActive,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to approve client: ${message}` }, { status: 500 })
  }
}
