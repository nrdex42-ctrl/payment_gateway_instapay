/**
 * Authentication and authorization utilities for the multi-tenant gateway.
 *
 * Two authentication scopes:
 *
 * 1. CLIENT auth (apiKey / detectToken)
 *    - Used by the client's project (apiKey) to create checkouts and check status.
 *    - Used by the client's Android APK (detectToken) to report detected payments.
 *
 * 2. OWNER auth (JWT session token)
 *    - Used by the platform admin to manage clients and view platform-wide data.
 */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import type { Client } from '@prisma/client'

// ─── Client Auth (API Key) ─────────────────────────────────────────

/**
 * Extracts the bearer token from the Authorization header.
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    return token || null
  }
  return null
}

/**
 * Authenticates a request by looking up the client's API key.
 * Used for checkout create, checkout status, and other client-facing endpoints.
 */
export async function authenticateByApiKey(request: NextRequest): Promise<Client | null> {
  const apiKey = extractBearerToken(request)
  if (!apiKey) return null

  try {
    const client = await db.client.findUnique({
      where: { apiKey },
    })
    if (!client || !client.isActive) return null
    return client
  } catch {
    return null
  }
}

/**
 * Authenticates a request by looking up the client's detect token.
 * Used by the Android APK webhook endpoint.
 */
export async function authenticateByDetectToken(request: NextRequest): Promise<Client | null> {
  const detectToken = extractBearerToken(request)
  if (!detectToken) return null

  try {
    const client = await db.client.findUnique({
      where: { detectToken },
    })
    if (!client || !client.isActive) return null
    return client
  } catch {
    return null
  }
}

// ─── Owner Auth (simple token-based for now) ───────────────────────

/**
 * Authenticates the platform owner using the OWNER_SECRET env var.
 * This is a simple shared-secret approach. For production you'd use
 * JWT sessions with bcrypt password verification against the Owner table.
 *
 * The owner authenticates with: Authorization: Bearer <OWNER_SECRET>
 */
export async function authenticateOwner(request: NextRequest): Promise<boolean> {
  const ownerSecret = process.env.OWNER_SECRET
  if (!ownerSecret) return false

  const token = extractBearerToken(request)
  if (!token) return false

  return token === ownerSecret
}

// ─── Token Generation ──────────────────────────────────────────────

/**
 * Generates a cryptographically random token for API keys and detect tokens.
 * Format: prefix + 32 hex characters (128 bits of entropy).
 */
export function generateSecureToken(prefix: string = 'ipk'): string {
  const chars = 'abcdef0123456789'
  let hex = ''
  for (let i = 0; i < 32; i++) {
    hex += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${prefix}_${hex}`
}

/**
 * Generates a URL-safe slug from a business name.
 */
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

// ─── HMAC for client webhooks ──────────────────────────────────────

/**
 * Signs a payload with the client's webhook secret using HMAC-SHA256.
 * The signature is sent as the X-Instapay-Signature header.
 */
export async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
