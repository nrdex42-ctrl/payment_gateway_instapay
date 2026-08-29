import { NextRequest } from 'next/server'

interface RateLimitRecord {
  count: number
  resetAt: number
}

// In-memory cache for sliding-window request tracking
const rateLimitCache = new Map<string, RateLimitRecord>()

export interface RateLimitResult {
  success: boolean
  count: number
  limit: number
  resetMs: number
}

/**
 * Check request frequency limits for a client IP.
 */
export function checkRateLimit(
  request: NextRequest,
  limit: number,
  windowMs: number
): RateLimitResult {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown-ip'
  
  // Scopes the rate limit key to the endpoint path and IP
  const key = `${request.nextUrl.pathname}:${ip}`
  const now = Date.now()

  let record = rateLimitCache.get(key)

  if (!record || now > record.resetAt) {
    record = {
      count: 0,
      resetAt: now + windowMs,
    }
  }

  record.count++
  rateLimitCache.set(key, record)

  const success = record.count <= limit
  const resetMs = Math.max(0, record.resetAt - now)

  return {
    success,
    count: record.count,
    limit,
    resetMs,
  }
}

/**
 * Generates standard rate limit headers to attach to Next.js responses.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.limit - result.count)),
    'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.resetMs) / 1000)),
  }
}
