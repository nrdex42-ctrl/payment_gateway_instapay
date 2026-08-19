import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const ADMIN_EMAIL = 'instapay.payment.gateway@gmail.com'
const ADMIN_PASSWORD = 'premiumservice@2026'
// 32-character base32 key for TOTP
const TOTP_SECRET_BASE32 = 'KVKVEV2UNJ3VOW3PMRUW4ZLDMUQHS4CT'

function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = base32.toUpperCase().replace(/=+$/, '')
  const length = clean.length
  const bytes = new Uint8Array(Math.floor((length * 5) / 8))
  
  let buffer = 0
  let bitsLeft = 0
  let byteIndex = 0
  
  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(clean[i])
    if (val === -1) throw new Error('Invalid base32 character')
    buffer = (buffer << 5) | val
    bitsLeft += 5
    if (bitsLeft >= 8) {
      bytes[byteIndex++] = (buffer >> (bitsLeft - 8)) & 0xff
      bitsLeft -= 8
    }
  }
  return Buffer.from(bytes)
}

function generateTOTP(secretBase32: string, time: number = Date.now()): string {
  const key = base32Decode(secretBase32)
  const counter = Math.floor(time / 30000)
  
  const buffer = Buffer.alloc(8)
  let tmp = counter
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff
    tmp = tmp >>> 8
  }
  
  const hmac = crypto.createHmac('sha1', key)
  hmac.update(buffer)
  const hmacResult = hmac.digest()
  
  const offset = hmacResult[hmacResult.length - 1] & 0xf
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)
    
  const otp = code % 1000000
  return otp.toString().padStart(6, '0')
}

function verifyTOTP(secretBase32: string, code: string, window: number = 1): boolean {
  const now = Date.now()
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secretBase32, now + i * 30000) === code) {
      return true
    }
  }
  return false
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secret, email, password, totp } = body || {}

    const ownerSecret = process.env.OWNER_SECRET
    if (!ownerSecret) return NextResponse.json({ error: 'OWNER_SECRET not configured' }, { status: 500 })

    // Support email/password/totp authentication
    if (email !== undefined || password !== undefined || totp !== undefined) {
      if (
        email !== ADMIN_EMAIL ||
        password !== ADMIN_PASSWORD ||
        !totp ||
        !verifyTOTP(TOTP_SECRET_BASE32, totp.trim())
      ) {
        return NextResponse.json(
          { ok: false, error: 'Invalid admin credentials or 2FA code.' },
          { status: 401 }
        )
      }
      return NextResponse.json({
        ok: true,
        token: ownerSecret,
      })
    }

    // Support legacy secret authentication
    if (!secret || secret !== ownerSecret) {
      return NextResponse.json(
        { ok: false, error: 'Invalid admin secret token.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      ok: true,
      token: ownerSecret,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Authentication failed.' },
      { status: 500 }
    )
  }
}
