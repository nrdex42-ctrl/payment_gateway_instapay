import { NextRequest, NextResponse } from 'next/server'
import {
  getEgyptDstMode,
  setEgyptDstMode,
  getEgyptOffsetMinutes,
  formatEgyptTime,
  EgyptDstMode,
} from '@/lib/timezone'
import { authenticateOwner } from '@/lib/auth'

/**
 * GET: Retrieve current global DST and Egypt Time info.
 */
export async function GET() {
  const mode = getEgyptDstMode()
  const now = new Date()
  const offset = getEgyptOffsetMinutes(now, mode)
  const isSummer = offset === 180

  return NextResponse.json({
    ok: true,
    timezone: 'Africa/Cairo',
    dstMode: mode,
    dstActive: isSummer,
    offsetMinutes: offset,
    currentEgyptTime: formatEgyptTime(now, mode),
  })
}

/**
 * POST: Update global DST / Summer Time mode.
 * Secure: Requires platform owner authorization.
 */
export async function POST(request: NextRequest) {
  const isOwner = await authenticateOwner(request)
  if (!isOwner) {
    // Local dev sandbox fallback
    const ownerSecret = process.env.OWNER_SECRET || 'owner-sandbox-secret-token-2026'
    const authHeader = request.headers.get('authorization') || ''
    const provided = authHeader.replace(/^Bearer\s+/, '').trim()
    if (provided !== ownerSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    const body = await request.json()
    const newMode: EgyptDstMode = body.dstMode

    if (!['AUTO', 'SUMMER', 'WINTER'].includes(newMode)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid dstMode. Must be AUTO, SUMMER, or WINTER' },
        { status: 400 }
      )
    }

    const updatedMode = setEgyptDstMode(newMode)
    const now = new Date()
    const offset = getEgyptOffsetMinutes(now, updatedMode)

    return NextResponse.json({
      ok: true,
      message: `Egypt Summer Time / DST mode updated to ${updatedMode}`,
      dstMode: updatedMode,
      dstActive: offset === 180,
      offsetMinutes: offset,
      currentEgyptTime: formatEgyptTime(now, updatedMode),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Failed to update settings: ${message}` },
      { status: 500 }
    )
  }
}
