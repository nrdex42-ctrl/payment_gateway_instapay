import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const plans = await db.plan.findMany({
      orderBy: { priceEgp: 'asc' }
    })
    return NextResponse.json({ ok: true, plans })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to fetch plans: ${message}` },
      { status: 500 }
    )
  }
}
