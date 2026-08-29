import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { hashPassword, generateSlug } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'
import { normalizeEmail, validateMerchantSignupEmail } from '@/lib/emailValidation'

const OTP_PURPOSE = 'MERCHANT_SIGNUP'

function hashOtp(email: string, otp: string): string {
  const secret = process.env.OWNER_SECRET
  if (!secret) throw new Error('OWNER_SECRET environment variable is missing.')
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex')
}

export async function POST(request: NextRequest) {
  // Enforce Rate Limit: max 5 merchant registrations per 10 minutes
  const rl = checkRateLimit(request, 5, 10 * 60 * 1000)
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: 'Too many registration requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    )
  }
  try {
    const body = await request.json()
    const { businessName, email, password, verificationId, otp } = body || {}
    const normalizedEmail = normalizeEmail(email || '')

    if (!businessName?.trim() || !normalizedEmail || !password?.trim() || !verificationId?.trim() || !otp?.trim()) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }

    const emailError = validateMerchantSignupEmail(normalizedEmail)
    if (emailError) {
      return NextResponse.json({ ok: false, error: emailError }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 8 characters long and contain both letters and numbers.' },
        { status: 400 }
      )
    }

    // Check if email already registered
    const existingEmail = await db.client.findUnique({
      where: { email: normalizedEmail },
    })
    if (existingEmail) {
      return NextResponse.json(
        { ok: false, error: 'This email is already registered.' },
        { status: 400 }
      )
    }

    const verification = await db.emailVerification.findUnique({
      where: { id: String(verificationId).trim() },
    })
    const otpValue = String(otp).trim()
    const expectedOtpHash = hashOtp(normalizedEmail, otpValue)
    const otpValid =
      verification &&
      verification.email === normalizedEmail &&
      verification.purpose === OTP_PURPOSE &&
      !verification.consumedAt &&
      verification.expiresAt.getTime() > Date.now() &&
      verification.attempts < 5 &&
      verification.otpHash === expectedOtpHash

    if (!verification || verification.email !== normalizedEmail) {
      return NextResponse.json({ ok: false, error: 'Please request a new email verification code.' }, { status: 400 })
    }

    if (!otpValid) {
      await db.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      }).catch(() => {})
      return NextResponse.json({ ok: false, error: 'Invalid or expired verification code.' }, { status: 400 })
    }

    let slug = generateSlug(businessName)
    let existingSlug = await db.client.findUnique({ where: { slug } })
    let count = 1
    while (existingSlug) {
      slug = `${generateSlug(businessName)}-${count}`
      existingSlug = await db.client.findUnique({ where: { slug } })
      count++
    }

    const provisionalHandle = `${slug}@instapay`

    const passwordHash = hashPassword(password)

    // Fetch FREE_TRIAL plan configurations
    const freeTrialPlan = await db.plan.findUnique({
      where: { name: 'FREE_TRIAL' }
    })
    const trialLimit = freeTrialPlan ? freeTrialPlan.maxTransactions : 5

    const client = await db.client.create({
      data: {
        businessName: businessName.trim(),
        slug,
        instapayHandle: provisionalHandle,
        email: normalizedEmail,
        passwordHash,
        approvalStatus: 'PENDING',
        isActive: false, // inactive until approved
        apiKey: null,
        detectToken: null,
        subscriptionPlan: 'FREE_TRIAL',
        isFreeTrial: true,
        subscriptionEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        txLimit: trialLimit,
        txCount: 0,
      },
    })

    await db.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    }).catch(() => {})

    const response = NextResponse.json({
      ok: true,
      message: 'Registration successful! Your account is pending admin approval.',
      client: {
        id: client.id,
        businessName: client.businessName,
        slug: client.slug,
        email: client.email,
        approvalStatus: client.approvalStatus,
      },
    })

    const rlHeaders = getRateLimitHeaders(rl)
    Object.entries(rlHeaders).forEach(([k, v]) => {
      response.headers.set(k, v)
    })

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: `Registration failed: ${message}` }, { status: 500 })
  }
}
