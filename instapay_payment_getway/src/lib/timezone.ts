/**
 * Timezone and Egypt Daylight Saving Time (Summer Time) Utility.
 *
 * Supports 3 Owner-controlled DST modes:
 *   - 'AUTO'   : Africa/Cairo IANA timezone (auto DST: UTC+3 in Summer, UTC+2 in Winter)
 *   - 'SUMMER' : Forced Egypt Summer Time (UTC+3 / EEST)
 *   - 'WINTER' : Forced Egypt Winter Time (UTC+2 / EET)
 */

import { db } from '@/lib/db'

export type EgyptDstMode = 'AUTO' | 'SUMMER' | 'WINTER'

let activeDstMode: EgyptDstMode = 'AUTO'
let cachedDstMode: EgyptDstMode | null = null
let cacheExpiresAt = 0

export async function getEgyptDstMode(): Promise<EgyptDstMode> {
  const now = Date.now()
  if (cachedDstMode && now < cacheExpiresAt) {
    activeDstMode = cachedDstMode
    return cachedDstMode
  }
  try {
    const owner = await db.owner.findFirst({ select: { dstMode: true } })
    if (owner && owner.dstMode) {
      cachedDstMode = owner.dstMode as EgyptDstMode
    } else {
      cachedDstMode = 'AUTO'
    }
  } catch {
    cachedDstMode = cachedDstMode || 'AUTO'
  }
  activeDstMode = cachedDstMode
  cacheExpiresAt = now + 5000 // Cache for 5 seconds to avoid DB spam
  return cachedDstMode
}

export async function setEgyptDstMode(mode: EgyptDstMode): Promise<EgyptDstMode> {
  if (!['AUTO', 'SUMMER', 'WINTER'].includes(mode)) {
    return activeDstMode
  }

  const result = await db.owner.updateMany({
    data: { dstMode: mode },
  })

  if (result.count === 0) {
    throw new Error('No platform owner record was found to save DST mode.')
  }

  cachedDstMode = mode
  activeDstMode = mode
  cacheExpiresAt = Date.now() + 5000

  return mode
}

/**
 * Returns the timezone offset in minutes for Egypt based on date & active DST mode.
 * UTC+2 = +120 minutes
 * UTC+3 = +180 minutes
 */
export function getEgyptOffsetMinutes(date: Date = new Date(), mode: EgyptDstMode = activeDstMode): number {
  if (mode === 'SUMMER') return 180
  if (mode === 'WINTER') return 120

  // AUTO mode: Check if Africa/Cairo is in DST (+3) or Standard (+2) for this date
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(date)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    if (tzPart) {
      if (tzPart.value.includes('+3') || tzPart.value.includes('GMT+3')) return 180
      if (tzPart.value.includes('+2') || tzPart.value.includes('GMT+2')) return 120
    }
  } catch {
    // fallback
  }

  // Fallback for Egypt DST calculation (Last Friday of April to Last Thursday of October)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() // 0-indexed (3 = April, 9 = October)
  
  if (month > 3 && month < 9) return 180 // May to Sept is Summer (+3)
  if (month < 3 || month > 9) return 120 // Nov to March is Winter (+2)

  // April check (starts last Friday of April)
  if (month === 3) {
    const lastDayApril = new Date(Date.UTC(year, 3, 30))
    const lastFridayApril = 30 - ((lastDayApril.getUTCDay() + 2) % 7)
    if (date.getUTCDate() >= lastFridayApril) return 180
    return 120
  }

  // October check (ends last Thursday of October)
  if (month === 9) {
    const lastDayOct = new Date(Date.UTC(year, 9, 31))
    const lastThursdayOct = 31 - ((lastDayOct.getUTCDay() + 3) % 7)
    if (date.getUTCDate() < lastThursdayOct) return 180
    return 120
  }

  return 180
}

/**
 * Returns a Date object representing the start of today (00:00:00.000) in Egypt Local Time.
 */
export function getStartOfTodayEgypt(now: Date = new Date(), mode: EgyptDstMode = activeDstMode): Date {
  const offsetMs = getEgyptOffsetMinutes(now, mode) * 60 * 1000
  const localTimeMs = now.getTime() + offsetMs
  const localDate = new Date(localTimeMs)

  // Clear local hours/minutes/seconds/ms
  const year = localDate.getUTCFullYear()
  const month = localDate.getUTCMonth()
  const day = localDate.getUTCDate()

  // Convert back to UTC timestamp representing Egypt 00:00:00
  const startLocalMs = Date.UTC(year, month, day, 0, 0, 0, 0)
  return new Date(startLocalMs - offsetMs)
}

/**
 * Returns a YYYY-MM-DD string representing the date in Egypt Local Time.
 */
export function getEgyptDayKey(date: Date, mode: EgyptDstMode = activeDstMode): string {
  const offsetMs = getEgyptOffsetMinutes(date, mode) * 60 * 1000
  const localDate = new Date(date.getTime() + offsetMs)
  return localDate.toISOString().slice(0, 10)
}

/**
 * Formats a date into Egypt Local Time string with AM/PM and DST indicator.
 */
export function formatEgyptTime(dateInput: Date | string | number | null | undefined, mode: EgyptDstMode = activeDstMode): string {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''

  const offsetMinutes = getEgyptOffsetMinutes(date, mode)
  const isSummer = offsetMinutes === 180
  const tzLabel = isSummer ? 'EEST (UTC+3)' : 'EET (UTC+2)'

  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: mode === 'AUTO' ? 'Africa/Cairo' : (isSummer ? 'Etc/GMT-3' : 'Etc/GMT-2'),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }
    return `${new Intl.DateTimeFormat('en-US', options).format(date)} (${tzLabel})`
  } catch {
    return `${date.toISOString()} (${tzLabel})`
  }
}
