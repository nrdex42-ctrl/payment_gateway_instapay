const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '20minutemail.com',
  '33mail.com',
  'anonaddy.com',
  'burnermail.io',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'moakt.com',
  'mohmal.com',
  'mohmal.in',
  'mohmal.tech',
  'sharklasers.com',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
  'yopmail.fr',
])

const DISPOSABLE_DOMAIN_KEYWORDS = [
  '10minute',
  'burner',
  'disposable',
  'guerrilla',
  'mailinator',
  'mohmal',
  'tempmail',
  'throwaway',
  'trashmail',
  'yopmail',
]

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

export function getEmailDomain(email: string): string {
  return normalizeEmail(email).split('@')[1] || ''
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
}

export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email)
  if (!domain) return false
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true

  const parts = domain.split('.')
  for (let index = 0; index < parts.length - 1; index++) {
    const parentDomain = parts.slice(index).join('.')
    if (DISPOSABLE_EMAIL_DOMAINS.has(parentDomain)) return true
  }

  return DISPOSABLE_DOMAIN_KEYWORDS.some((keyword) => domain.includes(keyword))
}

export function validateMerchantSignupEmail(email: string): string | null {
  if (!isValidEmailFormat(email)) return 'Invalid email address.'
  if (isDisposableEmail(email)) {
    return 'Temporary or disposable email addresses are not allowed. Please use a real business email or Gmail account.'
  }
  return null
}
