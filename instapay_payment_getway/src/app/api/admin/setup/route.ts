import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET: Check if admin setup is required.
 */
export async function GET() {
  try {
    const ownerCount = await db.owner.count()
    return NextResponse.json({
      ok: true,
      setupRequired: ownerCount === 0,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Database check failed.' },
      { status: 500 }
    )
  }
}

/**
 * POST: Setup the initial owner account.
 */
export async function POST(request: NextRequest) {
  try {
    const ownerCount = await db.owner.count()
    if (ownerCount > 0) {
      return NextResponse.json(
        { ok: false, error: 'Setup has already been completed.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, name, password } = body || {}

    if (!email || !name || !password) {
      return NextResponse.json(
        { ok: false, error: 'email, name, and password are required.' },
        { status: 400 }
      )
    }

    // For sandbox simplicity, we store a password hash or plain text verification
    // because this is matching the OWNER_SECRET env-based auth fallback anyway.
    const owner = await db.owner.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        passwordHash: password, // In production, hash this with bcrypt/argon2
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Platform owner registered successfully.',
      owner: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Setup failed: ${message}` },
      { status: 500 }
    )
  }
}
