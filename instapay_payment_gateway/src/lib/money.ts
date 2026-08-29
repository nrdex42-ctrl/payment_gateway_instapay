export function toEgpCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromEgpCents(cents: number | null | undefined): number | null {
  return typeof cents === 'number' ? cents / 100 : null
}

export function egpAmountFromRow(row: { amountEgp: number; amountCents?: number | null }): number {
  return fromEgpCents(row.amountCents) ?? row.amountEgp
}

export function detectedEgpAmountFromRow(row: {
  detectedAmountEgp?: number | null
  detectedAmountCents?: number | null
}): number | null {
  return fromEgpCents(row.detectedAmountCents) ?? row.detectedAmountEgp ?? null
}
