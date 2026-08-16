import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const clients = await db.client.findMany({
      where: {
        approvalStatus: 'APPROVED',
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        businessName: true,
        instapayHandle: true,
      },
      orderBy: { businessName: 'asc' },
    })

    return NextResponse.json({ ok: true, merchants: clients })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Failed to fetch merchants.' }, { status: 500 })
  }
}
