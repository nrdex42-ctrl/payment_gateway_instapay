import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'
import { sendOtpEmail } from '@/lib/emailDelivery'
import { normalizeEmail } from '@/lib/emailValidation'

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_PURPOSE = 'MERCHANT_LOGIN'
function hashOtp(email: string, otp: string) {
  const secret = process.env.OWNER_SECRET
  if (!secret) throw new Error('OWNER_SECRET environment variable is missing.')
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 10, 60 * 1000)
    if (!rl.success) return NextResponse.json({ ok: false, error: 'Too many login attempts. Please try again later.' }, { status: 429, headers: getRateLimitHeaders(rl) })
    const body = await request.json()
    const email = normalizeEmail(String(body?.email || ''))
    const password = String(body?.password || '')
    const verificationId = String(body?.verificationId || '').trim()
    const otp = String(body?.otp || '').trim()
    if (!email || !password) return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 })
    const client = await db.client.findUnique({ where: { email } })
    if (!client || !verifyPassword(password, client.passwordHash)) return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 })
    if (client.approvalStatus === 'PENDING') return NextResponse.json({ ok: false, error: 'Your merchant account is pending admin approval.' }, { status: 403 })
    if (client.approvalStatus === 'REJECTED' || !client.isActive) return NextResponse.json({ ok: false, error: 'Your merchant account is not active.' }, { status: 403 })
    if (!client.detectToken) return NextResponse.json({ ok: false, error: 'Your merchant account API keys have not been generated yet.' }, { status: 403 })
    if (!verificationId || !otp) {
      const code = crypto.randomInt(100000, 1000000).toString()
      const verification = await db.emailVerification.create({ data: { email, otpHash: hashOtp(email, code), purpose: OTP_PURPOSE, expiresAt: new Date(Date.now() + OTP_TTL_MS) } })
      await sendOtpEmail({ to: email, otp: code })
      return NextResponse.json({ ok: true, otpRequired: true, verificationId: verification.id, expiresInSeconds: OTP_TTL_MS / 1000 })
    }
    const verification = await db.emailVerification.findUnique({ where: { id: verificationId } })
    const valid = verification && verification.email === email && verification.purpose === OTP_PURPOSE && !verification.consumedAt && verification.expiresAt.getTime() > Date.now() && verification.attempts < 5 && verification.otpHash === hashOtp(email, otp)
    if (!verification || !valid) {
      if (verification) await db.emailVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } }).catch(() => {})
      return NextResponse.json({ ok: false, error: 'Invalid or expired verification code.' }, { status: 400 })
    }
    await db.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } })
    const response = NextResponse.json({
      ok: true,
      message: 'Logged in successfully.',
      apiKey: client.apiKey,
      detectToken: client.detectToken,
      instapayHandle: client.instapayHandle,
      businessName: client.businessName,
      businessType: client.businessType,
      email: client.email,
      subscriptionPlan: client.subscriptionPlan,
      subscriptionEndsAt: client.subscriptionEndsAt?.toISOString() || null,
      webhookUrl: client.webhookUrl,
      instapayPaymentUrl: client.instapayPaymentUrl,
      checkoutTtlMin: client.checkoutTtlMin,
    })
    Object.entries(getRateLimitHeaders(rl)).forEach(([k, v]) => response.headers.set(k, v))
    return response
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Login failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 500 })
  }
}
