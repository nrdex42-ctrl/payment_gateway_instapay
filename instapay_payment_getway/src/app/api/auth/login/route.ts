import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { verifyPassword, createSessionToken } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'
import { sendOtpEmail } from '@/lib/emailDelivery'
import { normalizeEmail } from '@/lib/emailValidation'

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_PURPOSE = 'MERCHANT_LOGIN'

function hashOtp(email: string, otp: string): string {
  const secret = process.env.OWNER_SECRET
  if (!secret) throw new Error('OWNER_SECRET environment variable is missing.')
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex')
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

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
    const verificationId = String(body?.verificationId || '').trim()
    const otp = String(body?.otp || '').trim()

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 })
    }

    const normalizedEmail = normalizeEmail(email)
    const client = await db.client.findUnique({
      where: { email: normalizedEmail },
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

    if (!verificationId || !otp) {
      const loginOtp = generateOtp()
      const verification = await db.emailVerification.create({
        data: {
          email: normalizedEmail,
          otpHash: hashOtp(normalizedEmail, loginOtp),
          purpose: OTP_PURPOSE,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      })

      await sendOtpEmail({ to: normalizedEmail, otp: loginOtp })

      const response = NextResponse.json({
        ok: true,
        otpRequired: true,
        verificationId: verification.id,
        message: 'Login verification code sent.',
        expiresInSeconds: OTP_TTL_MS / 1000,
      })
      Object.entries(getRateLimitHeaders(rl)).forEach(([k, v]) => response.headers.set(k, v))
      return response
    }

    const verification = await db.emailVerification.findUnique({ where: { id: verificationId } })
    const expectedOtpHash = hashOtp(normalizedEmail, otp)
    const otpValid =
      verification &&
      verification.email === normalizedEmail &&
      verification.purpose === OTP_PURPOSE &&
      !verification.consumedAt &&
      verification.expiresAt.getTime() > Date.now() &&
      verification.attempts < 5 &&
      verification.otpHash === expectedOtpHash

    if (!verification || verification.email !== normalizedEmail) {
      return NextResponse.json({ ok: false, error: 'Please request a new login verification code.' }, { status: 400 })
    }

    if (!otpValid) {
      await db.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      }).catch(() => {})
      return NextResponse.json({ ok: false, error: 'Invalid or expired login verification code.' }, { status: 400 })
    }

    await db.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    }).catch(() => {})

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
