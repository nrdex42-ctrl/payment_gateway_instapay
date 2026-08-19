import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSessionToken } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    // Enforce Rate Limit: max 10 requests per 1 minute
    const rl = checkRateLimit(request, 10, 60 * 1000)
    if (!rl.success) {
      return NextResponse.json(
        { ok: false, error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rl) }
      )
    }

    const body = await request.json()
    const { email, password } = body || {}

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 })
    }

    const client = await db.client.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    if (!client) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 })
    }

    // Verify Password
    const isValid = verifyPassword(password, client.passwordHash)
    if (!isValid) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 })
    }

    // Check approval status
    if (client.approvalStatus === 'PENDING') {
      return NextResponse.json(
        { ok: false, error: 'Your merchant account is pending admin approval. You will receive access once approved.' },
        { status: 403 }
      )
    }

    if (client.approvalStatus === 'REJECTED') {
      return NextResponse.json(
        { ok: false, error: 'Your merchant account registration was rejected. Contact admin for details.' },
        { status: 403 }
      )
    }

    if (!client.isActive) {
      return NextResponse.json(
        { ok: false, error: 'Your merchant account is currently disabled.' },
        { status: 403 }
      )
    }

    // Create session
    const token = createSessionToken(client.id)

    const response = NextResponse.json({
      ok: true,
      message: 'Logged in successfully.',
      client: {
        id: client.id,
        businessName: client.businessName,
        slug: client.slug,
        email: client.email,
        instapayHandle: client.instapayHandle,
      },
      token,
    })

    // Set secure HTTP-only cookie
    response.cookies.set('instapay_merchant_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 1 day
      path: '/',
    })

    // Attach headers
    const rlHeaders = getRateLimitHeaders(rl)
    Object.entries(rlHeaders).forEach(([k, v]) => {
      response.headers.set(k, v)
    })

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Login failed: ${message}` }, { status: 500 })
  }
}
