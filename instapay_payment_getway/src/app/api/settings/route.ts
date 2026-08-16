import { NextResponse } from 'next/server'
import {
  getEgyptDstMode,
  setEgyptDstMode,
  getEgyptOffsetMinutes,
  formatEgyptTime,
  EgyptDstMode,
} from '@/lib/timezone'

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

export async function POST(request: Request) {
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
