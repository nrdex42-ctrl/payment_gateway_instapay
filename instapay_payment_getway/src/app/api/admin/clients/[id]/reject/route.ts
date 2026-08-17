import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateOwner } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ ok: false, error: 'Client account not found.' }, { status: 404 })
    }

    const updated = await db.client.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        isActive: false,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'REJECT_MERCHANT',
        details: `Rejected merchant registration: ${updated.businessName} (ID: ${updated.id})`,
      }
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      message: `Merchant account registration rejected.`,
      client: {
        id: updated.id,
        businessName: updated.businessName,
        approvalStatus: updated.approvalStatus,
        isActive: updated.isActive,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Failed to reject client: ${message}` }, { status: 500 })
  }
}
