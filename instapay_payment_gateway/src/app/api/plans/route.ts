import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const plans = await db.plan.findMany({
      select: {
        id: true,
        name: true,
        priceEgp: true,
        maxTransactions: true,
      },
      orderBy: { priceEgp: 'asc' },
    })
    return NextResponse.json({ ok: true, plans })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch plans.' },
      { status: 500 }
    )
  }
}
