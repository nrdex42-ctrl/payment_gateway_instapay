/**
 * Merchant and InstaPay payment-link helper functions for multi-tenant payments.
 */

/**
 * Extracts the local part of an InstaPay handle.
 * E.g., "ahmed_shop@instapay" or "@ahmed_shop" -> "ahmed_shop"
 */
export function getLocalPart(handle: string): string {
  const clean = (handle || '').trim().toLowerCase().replace(/^@/, '')
  return clean.split('@')[0].replace(/[^a-z0-9_.-]/g, '') || ''
}

/**
 * Validates and normalizes an exact static InstaPay APK payment/share URL.
 *
 * Example output:
 *   paymentUrl: "https://ipn.eg/S/ahmed_shop/instapay/1QduWC"
 */
export function normalizeInstaPayPaymentUrl(rawUrl: string): string {
  const value = (rawUrl || '').trim()
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'ipn.eg') {
    throw new Error('InstaPay payment URL must start with https://ipn.eg/.')
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 4 || parts[0] !== 'S' || parts[2] !== 'instapay') {
    throw new Error('Invalid InstaPay payment URL format. Expected https://ipn.eg/S/<account>/instapay/<token>.')
  }
  const localPart = getLocalPart(parts[1])
  const token = parts[3].trim()
  if (!localPart || !/^[A-Za-z0-9]+$/.test(token)) {
    throw new Error('Invalid InstaPay payment URL account or token.')
  }
  return `https://ipn.eg/S/${localPart}/instapay/${token}`
}

export function getTokenFromInstaPayPaymentUrl(paymentUrl: string): string {
  return new URL(paymentUrl).pathname.split('/').filter(Boolean)[3] || ''
}

/**
 * Returns the exact static InstaPay payment URL configured for this recipient.
 * The URL token is not generated or changed per checkout.
 */
export function resolveInstaPayPaymentLink(
  recipientHandle: string,
  configuredPaymentUrl?: string | null
): { deepLinkUrl: string; token: string } {
  if (configuredPaymentUrl) {
    const deepLinkUrl = normalizeInstaPayPaymentUrl(configuredPaymentUrl)
    return { deepLinkUrl, token: getTokenFromInstaPayPaymentUrl(deepLinkUrl) }
  }

  const localPart = getLocalPart(recipientHandle)
  if (!localPart) {
    throw new Error('Invalid InstaPay recipient handle.')
  }
  const token = process.env.DEFAULT_INSTAPAY_PAYMENT_TOKEN || '1QduWC'
  const deepLinkUrl = `https://ipn.eg/S/${localPart}/instapay/${token}`
  return { deepLinkUrl, token }
}

/**
 * Normalizes any user-entered string to a standard InstaPay handle format.
 * E.g., "@ahmed" -> "ahmed@instapay", "AHMED@instapay" -> "ahmed@instapay"
 */
export function normalizeHandle(raw: string): string {
  const local = getLocalPart(raw)
  return local ? `${local}@instapay` : ''
}
