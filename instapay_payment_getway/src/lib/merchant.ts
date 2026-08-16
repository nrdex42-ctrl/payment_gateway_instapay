/**
 * Merchant and Deep Link helper functions for multi-tenant.
 */

import { db } from './db'
import type { Client } from '@prisma/client'

/**
 * Extracts the local part of an InstaPay handle.
 * E.g., "ahmed_shop@instapay" or "@ahmed_shop" -> "ahmed_shop"
 */
export function getLocalPart(handle: string): string {
  const clean = (handle || '').trim().toLowerCase().replace(/^@/, '')
  return clean.split('@')[0] || ''
}

/**
 * Builds the official-looking InstaPay deep link for a recipient handle.
 * Pre-fills the recipient handle when scanned/clicked in the InstaPay APK.
 *
 * Example output:
 *   deepLinkUrl: "https://ipn.eg/S/ahmed_shop/instapay/CKT1A2B3C4"
 *   token: "CKT1A2B3C4"
 */
export function buildInstaPayDeepLink(recipientHandle: string): { deepLinkUrl: string; token: string } {
  const localPart = getLocalPart(recipientHandle)
  const token = generateShortToken()
  const deepLinkUrl = `https://ipn.eg/S/${localPart}/instapay/${token}`
  return { deepLinkUrl, token }
}

/**
 * Generates a short, URL-safe token (8 chars) used as the trailing
 * segment of the deep link. Used to differentiate checkout QR codes.
 */
export function generateShortToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return `CKT${out}`
}

/**
 * Normalizes any user-entered string to a standard InstaPay handle format.
 * E.g., "@ahmed" -> "ahmed@instapay", "AHMED@instapay" -> "ahmed@instapay"
 */
export function normalizeHandle(raw: string): string {
  const local = getLocalPart(raw)
  return local ? `${local}@instapay` : ''
}
