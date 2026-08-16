/**
 * Merchant configuration.
 *
 * Reads from environment variables so a single gateway deployment can be
 * pointed at any InstaPay merchant handle without code changes.
 *
 * Env vars:
 *   MERCHANT_HANDLE   — full InstaPay handle (default: mohammedshabana77@instapay)
 *   MERCHANT_NAME     — human-readable name for the dashboard (default: Mohammed Shabana)
 *   DETECT_TOKEN      — shared secret for the Android detector webhook
 *   CHECKOUT_TTL_MIN  — pending checkout lifetime in minutes (default: 10)
 */

export interface MerchantConfig {
  handle: string
  localPart: string
  name: string
  detectToken: string
  checkoutTtlMinutes: number
}

function parseHandle(raw: string): { handle: string; localPart: string } {
  let h = (raw || '').trim().toLowerCase().replace(/^@/, '')
  if (!h) h = 'mohammedshabana77@instapay'
  if (!h.endsWith('@instapay')) {
    h = `${h.split('@')[0]}@instapay`
  }
  return { handle: h, localPart: h.split('@')[0] }
}

let cached: MerchantConfig | null = null

export function getMerchantConfig(): MerchantConfig {
  if (cached) return cached

  const { handle, localPart } = parseHandle(
    process.env.MERCHANT_HANDLE || 'mohammedshabana77@instapay'
  )

  cached = {
    handle,
    localPart,
    name: process.env.MERCHANT_NAME || 'Mohammed Shabana',
    detectToken:
      process.env.DETECT_TOKEN || 'instapay-sandbox-detector-token-2026',
    checkoutTtlMinutes: Number(process.env.CHECKOUT_TTL_MIN || 10),
  }
  return cached
}

/**
 * Builds the official InstaPay deep link for this merchant.
 *
 * The real InstaPay app generates URLs of the form:
 *   https://ipn.eg/S/<localPart>/instapay/<shortToken>
 *
 * Clicking such a link on an Android/iOS device with the InstaPay app
 * installed opens the app with the recipient pre-filled. We can't mint
 * real ipn.eg tokens, so we generate a short random token that uniquely
 * identifies this checkout on our side. The link still opens the InstaPay
 * app and pre-fills the recipient handle — InstaPay ignores the token
 * for the recipient pre-fill, it only uses it for tracking/analytics.
 *
 * Example output:
 *   https://ipn.eg/S/mohammedshabana77/instapay/CKT1A2B3C4
 */
export function buildDeepLink(localPart: string, shortToken: string): string {
  return `https://ipn.eg/S/${localPart}/instapay/${shortToken}`
}

/**
 * Generates a short, URL-safe token (8 chars) used as the trailing
 * segment of the deep link. Not cryptographically strong — its only job
 * is to give each checkout a distinct deep-link URL.
 */
export function generateShortToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return `CKT${out}`
}
