import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
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
    const { email, password, instapayHandle } = body || {}

    if (!email?.trim() || !password?.trim() || !instapayHandle?.trim()) {
      return NextResponse.json({ ok: false, error: 'Email, password, and InstaPay handle are required.' }, { status: 400 })
    }

    // Normalize handle
    let handle = instapayHandle.trim().toLowerCase().replace(/^@/, '')
    if (!handle.endsWith('@instapay')) {
      handle = `${handle.split('@')[0]}@instapay`
    }

    const client = await db.client.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    if (!client) {
      return NextResponse.json({ ok: false, error: 'Invalid email, password, or InstaPay handle.' }, { status: 401 })
    }

    // Verify Password
    const isValid = verifyPassword(password, client.passwordHash)
    if (!isValid) {
      return NextResponse.json({ ok: false, error: 'Invalid email, password, or InstaPay handle.' }, { status: 401 })
    }

    // Verify InstaPay Handle
    if (client.instapayHandle.trim().toLowerCase() !== handle) {
      return NextResponse.json({ ok: false, error: 'Invalid email, password, or InstaPay handle.' }, { status: 401 })
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

    if (!client.detectToken) {
      return NextResponse.json(
        { ok: false, error: 'Your merchant account API keys have not been generated yet. Please contact admin.' },
        { status: 403 }
      )
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Logged in successfully.',
      detectToken: client.detectToken,
      instapayHandle: client.instapayHandle,
      businessName: client.businessName,
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
