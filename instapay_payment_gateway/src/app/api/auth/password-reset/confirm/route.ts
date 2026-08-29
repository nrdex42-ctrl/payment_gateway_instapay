import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'
import { isValidEmailFormat, normalizeEmail } from '@/lib/emailValidation'

const OTP_PURPOSE = 'PASSWORD_RESET'

function hashOtp(email: string, otp: string): string {
  const secret = process.env.OWNER_SECRET
  if (!secret) throw new Error('OWNER_SECRET environment variable is missing.')
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex')
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 5, 10 * 60 * 1000)
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: 'Too many password reset attempts. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    )
  }

  try {
    const body = await request.json()
    const email = normalizeEmail(body?.email || '')
    const verificationId = String(body?.verificationId || '').trim()
    const otp = String(body?.otp || '').trim()
    const password = String(body?.password || '')

    if (!email || !verificationId || !otp || !password) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }
    if (!isValidEmailFormat(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email address.' }, { status: 400 })
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 8 characters long and contain both letters and numbers.' },
        { status: 400 },
      )
    }

    const verification = await db.emailVerification.findUnique({ where: { id: verificationId } })
    const expectedOtpHash = hashOtp(email, otp)
    const otpValid =
      verification &&
      verification.email === email &&
      verification.purpose === OTP_PURPOSE &&
      !verification.consumedAt &&
      verification.expiresAt.getTime() > Date.now() &&
      verification.attempts < 5 &&
      verification.otpHash === expectedOtpHash

    if (!verification || verification.email !== email) {
      return NextResponse.json({ ok: false, error: 'Please request a new password reset code.' }, { status: 400 })
    }

    if (!otpValid) {
      await db.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      }).catch(() => {})
      return NextResponse.json({ ok: false, error: 'Invalid or expired reset code.' }, { status: 400 })
    }

    const client = await db.client.findUnique({ where: { email } })
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Please request a new password reset code.' }, { status: 400 })
    }

    await db.client.update({
      where: { id: client.id },
      data: { passwordHash: hashPassword(password) },
    })
    await db.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    }).catch(() => {})

    const response = NextResponse.json({ ok: true, message: 'Password updated successfully.' })
    Object.entries(getRateLimitHeaders(rl)).forEach(([key, value]) => response.headers.set(key, value))
    return response
  } catch (err) {
    console.error('[password-reset] failed to update password', err)
    return NextResponse.json(
      { ok: false, error: 'Password reset failed. Please try again later.' },
      { status: 500 },
    )
  }
}
