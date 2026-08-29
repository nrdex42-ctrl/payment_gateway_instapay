import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    ok: true,
    message: 'Logged out successfully.',
  })

  // Clear cookie by setting maxAge = 0
  response.cookies.set('instapay_merchant_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })

  return response
}
