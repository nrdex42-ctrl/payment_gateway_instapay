import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

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
    if (!ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Server is not configured.' }, { status: 500 })
    }

    // Email/password/TOTP authentication
    if (email !== undefined || password !== undefined || totp !== undefined) {
      const adminEmail = process.env.ADMIN_EMAIL
      const adminPassword = process.env.ADMIN_PASSWORD
      const totpSecret = process.env.ADMIN_TOTP_SECRET

      if (!adminEmail || !adminPassword || !totpSecret) {
        return NextResponse.json({ ok: false, error: 'Server is not configured.' }, { status: 500 })
      }

      const emailOk =
        typeof email === 'string' &&
        timingSafeEquals(email.trim().toLowerCase(), adminEmail.trim().toLowerCase())
      const passwordOk = typeof password === 'string' && timingSafeEquals(password, adminPassword)
      const totpOk = typeof totp === 'string' && verifyTOTP(totpSecret, totp.trim())

      if (!emailOk || !passwordOk || !totpOk) {
        return NextResponse.json(
          { ok: false, error: 'Invalid admin credentials or 2FA code.' },
          { status: 401 }
        )
      }

      return NextResponse.json({ ok: true, token: ownerSecret })
    }

    // Secret-token authentication
    if (typeof secret !== 'string' || !timingSafeEquals(secret, ownerSecret)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid admin secret token.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ ok: true, token: ownerSecret })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Authentication failed.' },
      { status: 500 }
    )
  }
}
