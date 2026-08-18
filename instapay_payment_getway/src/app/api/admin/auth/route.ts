import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin authentication endpoint.
 * Verifies the owner secret and returns a token for the admin dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secret } = body || {}

    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })

    if (!secret || secret !== ownerSecret) {
      return NextResponse.json(
        { ok: false, error: 'Invalid admin secret token.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      ok: true,
      token: ownerSecret,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Authentication failed.' },
      { status: 500 }
    )
  }
}
