/**
 * Authentication, Session Management, and Password Hashing for the Multi-Tenant Platform.
 *
 * Uses native Node.js 'crypto' module for secure, performant operations.
 */

import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { db } from './db'
import type { Client } from '@prisma/client'

const SESSION_COOKIE_NAME = 'instapay_merchant_session'

// ─── Password Hashing (Secure Scrypt) ──────────────────────────────

/**
 * Hashes a plain-text password using Node.js scrypt sync.
 * Returns a string in format: "salt.hash" (hex encoded).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}.${derivedKey.toString('hex')}`
}

/**
 * Verifies a password against a stored scrypt hash.
 * Utilizes a constant timing check path to prevent user enumeration timings.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const dummyHash = 'd7d8e8b0a9c8d7e6f5a4b3c2d1e0f9a8b7.c5d753f0c97333b3b3e882c657419c1606d7689933532099665293a3965e6a2d9eca1f012b2a2c186f5441450215d2f37680a8e4fbeaf08e41880b9702d3'
  const hasFormat = storedHash && storedHash.includes('.')
  const targetHash = hasFormat ? storedHash : dummyHash

  const [salt, hash] = targetHash.split('.')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  const isMatch = timingSafeCompare(derivedKey.toString('hex'), hash)

  if (!hasFormat) return false
  return isMatch
}

// ─── Session Management (Signed Payload) ───────────────────────────

interface SessionPayload {
  clientId: string
  expiresAt: number
}

interface OwnerSessionPayload {
  subject: 'owner'
  scope: 'admin'
  issuedAt: number
  expiresAt: number
}

function getOwnerSecret(): string {
  const secret = process.env.OWNER_SECRET
  if (!secret) {
    throw new Error('OWNER_SECRET environment variable is missing. Authentication disabled for security.')
  }
  return secret
}

/**
 * Creates a signed stateless session token for client authentication.
 */
export function createSessionToken(clientId: string): string {
  const secret = getOwnerSecret()
  const payload: SessionPayload = {
    clientId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  }
  const payloadStr = JSON.stringify(payload)
  const base64Payload = Buffer.from(payloadStr).toString('base64')
  
  // Sign the base64 payload using HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(base64Payload)
  const signature = hmac.digest('hex')

  return `${base64Payload}.${signature}`
}

/**
 * Verifies a session token and returns the clientId if valid, null otherwise.
 */
export function verifySessionToken(token: string | null): string | null {
  if (!token || !token.includes('.')) return null
  const secret = getOwnerSecret()
  const [base64Payload, signature] = token.split('.')

  try {
    // Recreate HMAC signature and verify
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(base64Payload)
    const expectedSignature = hmac.digest('hex')

    if (!timingSafeCompare(signature, expectedSignature)) return null

    // Decode and verify expiration
    const payloadStr = Buffer.from(base64Payload, 'base64').toString('utf8')
    const payload = JSON.parse(payloadStr) as SessionPayload

    if (Date.now() > payload.expiresAt) return null
    return payload.clientId
  } catch {
    return null
  }
}

/**
 * Creates a signed stateless admin session token.
 *
 * The browser should store this short-lived token instead of the raw OWNER_SECRET.
 */
export function createOwnerSessionToken(): string {
  const secret = getOwnerSecret()
  const payload: OwnerSessionPayload = {
    subject: 'owner',
    scope: 'admin',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  }
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(base64Payload).digest('hex')
  return `own.${base64Payload}.${signature}`
}

export function verifyOwnerSessionToken(token: string | null): boolean {
  if (!token || !token.startsWith('own.')) return false
  const [, base64Payload, signature] = token.split('.')
  if (!base64Payload || !signature) return false

  try {
    const secret = getOwnerSecret()
    const expectedSignature = crypto.createHmac('sha256', secret).update(base64Payload).digest('hex')
    if (!timingSafeCompare(signature, expectedSignature)) return false

    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8')) as OwnerSessionPayload
    return payload.subject === 'owner' && payload.scope === 'admin' && Date.now() <= payload.expiresAt
  } catch {
    return false
  }
}

/**
 * Retrieves the currently logged-in Client based on request session cookies or Auth headers.
 */
export async function getSessionClient(request: NextRequest): Promise<Client | null> {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization') || ''
  let token: string | null = null
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim()
  }

  // Fallback to cookie check
  if (!token) {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)
    token = cookie ? cookie.value : null
  }

  const clientId = verifySessionToken(token)
  if (!clientId) return null

  try {
    const client = await db.client.findUnique({
      where: { id: clientId },
    })
    if (!client || !client.isActive || client.approvalStatus !== 'APPROVED') return null
    return client
  } catch {
    return null
  }
}

// ─── API Auth (API Key & Webhook Token) ────────────────────────────

/**
 * Authenticates client API requests. Requires client to be approved & active.
 */
export async function authenticateByApiKey(request: NextRequest): Promise<Client | null> {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  const apiKey = authHeader.slice('Bearer '.length).trim()
  const apiKeyHash = hashSecret(apiKey)

  try {
    let client = await db.client.findUnique({ where: { apiKeyHash } })
    if (!client) {
      client = await db.client.findUnique({ where: { apiKey } })
      if (client && !client.apiKeyHash) {
        await db.client.update({
          where: { id: client.id },
          data: { apiKeyHash },
        }).catch(() => {})
      }
    }
    if (!client || !client.isActive || client.approvalStatus !== 'APPROVED') return null
    await db.client.update({
      where: { id: client.id },
      data: { apiKeyLastUsedAt: new Date() },
    }).catch(() => {})
    return client
  } catch {
    return null
  }
}

/**
 * Authenticates APK webhook requests. Requires client to be approved & active.
 */
export async function authenticateByDetectToken(request: NextRequest): Promise<Client | null> {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  const detectToken = authHeader.slice('Bearer '.length).trim()
  const detectTokenHash = hashSecret(detectToken)

  try {
    let client = await db.client.findUnique({ where: { detectTokenHash } })
    if (!client) {
      client = await db.client.findUnique({ where: { detectToken } })
      if (client && !client.detectTokenHash) {
        await db.client.update({
          where: { id: client.id },
          data: { detectTokenHash },
        }).catch(() => {})
      }
    }
    if (!client || !client.isActive || client.approvalStatus !== 'APPROVED') return null
    await db.client.update({
      where: { id: client.id },
      data: { detectTokenLastUsedAt: new Date() },
    }).catch(() => {})
    return client
  } catch {
    return null
  }
}

// ─── Admin Platform Auth ───────────────────────────────────────────

export async function authenticateOwner(request: NextRequest): Promise<boolean> {
  const ownerSecret = getOwnerSecret()
  const authHeader = request.headers.get('authorization') || ''
  let token: string | null = null
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim()
  }

  if (!token) return false
  if (verifyOwnerSessionToken(token)) return true
  return timingSafeCompare(token, ownerSecret)
}

// ─── Token Generation & Utilities ──────────────────────────────────

export function generateSecureToken(prefix: string = 'ipk'): string {
  const bytes = crypto.randomBytes(16).toString('hex')
  return `${prefix}_${bytes}`
}

export function hashSecret(secret: string): string {
  const pepper = process.env.TOKEN_PEPPER || getOwnerSecret()
  return crypto.createHmac('sha256', pepper).update(secret).digest('hex')
}

export function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

export async function signPayload(payload: string, secret: string): Promise<string> {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return hmac.digest('hex')
}

/**
 * Timing-safe string comparison helper.
 * Hashes strings using SHA-256 to allow timingSafeEqual on strings of different lengths.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest()
  const hashB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}
