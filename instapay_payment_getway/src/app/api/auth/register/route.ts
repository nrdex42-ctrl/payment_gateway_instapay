import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateSlug } from '@/lib/auth'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimit'

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
    const { businessName, instapayHandle, email, password } = body || {}

    if (!businessName?.trim() || !instapayHandle?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ ok: false, error: 'Invalid email address.' }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 8 characters long and contain both letters and numbers.' },
        { status: 400 }
      )
    }

    // Normalize handle
    let handle = instapayHandle.trim().toLowerCase().replace(/^@/, '')
    if (!handle.endsWith('@instapay')) {
      handle = `${handle.split('@')[0]}@instapay`
    }

    // Check if email already registered
    const existingEmail = await db.client.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (existingEmail) {
      return NextResponse.json(
        { ok: false, error: 'This email is already registered.' },
        { status: 400 }
      )
    }

    let slug = generateSlug(businessName)
    let existingSlug = await db.client.findUnique({ where: { slug } })
    let count = 1
    while (existingSlug) {
      slug = `${generateSlug(businessName)}-${count}`
      existingSlug = await db.client.findUnique({ where: { slug } })
      count++
    }

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
        instapayHandle: handle,
        email: email.trim().toLowerCase(),
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
