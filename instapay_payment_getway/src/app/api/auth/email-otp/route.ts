import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'
import { sendOtpEmail } from '@/lib/emailDelivery'
import { normalizeEmail, validateMerchantSignupEmail } from '@/lib/emailValidation'

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_PURPOSE = 'MERCHANT_SIGNUP'

function hashOtp(email: string, otp: string): string {
  const secret = process.env.OWNER_SECRET
  if (!secret) throw new Error('OWNER_SECRET environment variable is missing.')
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex')
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 3, 10 * 60 * 1000)
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: 'Too many verification code requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    )
  }

  try {
    const body = await request.json()
    const email = normalizeEmail(body?.email || '')
    const emailError = validateMerchantSignupEmail(email)
    if (emailError) {
      return NextResponse.json({ ok: false, error: emailError }, { status: 400 })
    }

    const existingEmail = await db.client.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ ok: false, error: 'This email is already registered.' }, { status: 400 })
    }

    const otp = generateOtp()
    const verification = await db.emailVerification.create({
      data: {
        email,
        otpHash: hashOtp(email, otp),
        purpose: OTP_PURPOSE,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    })

    await sendOtpEmail({ to: email, otp })

    const response = NextResponse.json({
      ok: true,
      verificationId: verification.id,
      message: 'Verification code sent.',
      expiresInSeconds: OTP_TTL_MS / 1000,
    })

    Object.entries(getRateLimitHeaders(rl)).forEach(([key, value]) => response.headers.set(key, value))
    return response
  } catch (err) {
    console.error('[email-otp] failed to send verification code', err)
    return NextResponse.json(
      { ok: false, error: 'Email verification service is temporarily unavailable. Please try again later.' },
      { status: 500 },
    )
  }
}
