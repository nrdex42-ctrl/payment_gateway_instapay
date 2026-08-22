/**
 * Merchant and InstaPay deep-link helper functions for multi-tenant payments.
 */

import crypto from 'crypto'

/**
 * Extracts the local part of an InstaPay handle.
 * E.g., "ahmed_shop@instapay" or "@ahmed_shop" -> "ahmed_shop"
 */
export function getLocalPart(handle: string): string {
  const clean = (handle || '').trim().toLowerCase().replace(/^@/, '')
  return clean.split('@')[0].replace(/[^a-z0-9_.-]/g, '') || ''
}

/**
 * Builds the official-looking InstaPay deep link for a recipient handle.
 * Pre-fills the recipient handle when scanned/clicked in the InstaPay APK.
 *
 * Example output:
 *   deepLinkUrl: "https://ipn.eg/S/ahmed_shop/instapay/1QduWC"
 *   token: "1QduWC"
 */
export function buildInstaPayDeepLink(recipientHandle: string): { deepLinkUrl: string; token: string } {
  const localPart = getLocalPart(recipientHandle)
  if (!localPart) {
    throw new Error('Invalid InstaPay recipient handle.')
  }
  const token = generateShortToken()
  const deepLinkUrl = `https://ipn.eg/S/${localPart}/instapay/${token}`
  return { deepLinkUrl, token }
}

/**
 * Generates a short, URL-safe token (6 chars) used as the trailing
 * segment of the deep link. Used to differentiate checkout QR codes.
 */
export function generateShortToken(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += chars[crypto.randomInt(chars.length)]
  }
  return out
}

/**
 * Normalizes any user-entered string to a standard InstaPay handle format.
 * E.g., "@ahmed" -> "ahmed@instapay", "AHMED@instapay" -> "ahmed@instapay"
 */
export function normalizeHandle(raw: string): string {
  const local = getLocalPart(raw)
  return local ? `${local}@instapay` : ''
}
