'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowDownLeft,
  Clock,
  Inbox,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DashboardData {
  ok: boolean
  merchant: { handle: string; name: string }
  stats: {
    today: { count: number; totalEgp: number }
    sevenDays: { count: number; totalEgp: number }
    pending: { count: number; totalEgp: number }
  }
  recent: Array<{
    sessionId: string
    senderHandle: string
    amountEgp: number
    currency: string
    detectedRef: string | null
    detectedAt: string | null
    note: string | null
  }>
}

export function MerchantDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        if (json.ok) setData(json)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Refresh every 10s while the dashboard is visible.
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load dashboard. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Merchant dashboard</h2>
          <p className="text-sm text-neutral-500">
            {data.merchant.name} ·{' '}
            <span className="font-mono">{data.merchant.handle}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          className="text-neutral-500"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Today"
          value={`${data.stats.today.totalEgp.toFixed(2)}`}
          unit="EGP"
          sub={`${data.stats.today.count} payment${data.stats.today.count === 1 ? '' : 's'}`}
          tone="emerald"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Last 7 days"
          value={`${data.stats.sevenDays.totalEgp.toFixed(2)}`}
          unit="EGP"
          sub={`${data.stats.sevenDays.count} payment${data.stats.sevenDays.count === 1 ? '' : 's'}`}
          tone="violet"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending"
          value={`${data.stats.pending.totalEgp.toFixed(2)}`}
          unit="EGP"
          sub={`${data.stats.pending.count} await${data.stats.pending.count === 1 ? 's' : ''} payment`}
          tone="amber"
        />
      </div>

      {/* Recent activity */}
      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
        <div className="border-b border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900">Recent activity</h3>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          <div className="p-2">
            {data.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">No payments yet</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Confirmed payments will appear here automatically.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-1">
                {data.recent.map((tx, idx) => (
                  <motion.li
                    key={tx.sessionId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                      <ArrowDownLeft className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-900">
                          {tx.senderHandle}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-emerald-600">
                          +{Number(tx.amountEgp).toFixed(2)} {tx.currency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-neutral-500">
                          {tx.detectedRef || tx.sessionId.slice(0, 12)}
                        </span>
                        <span className="shrink-0 text-[11px] text-neutral-400">
                          {tx.detectedAt ? formatRelative(tx.detectedAt) : ''}
                        </span>
                      </div>
                      {tx.note && (
                        <p className="mt-0.5 truncate text-xs italic text-neutral-400">
                          &ldquo;{tx.note}&rdquo;
                        </p>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  sub: string
  tone: 'emerald' | 'violet' | 'amber'
}) {
  const tones = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-100' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-100' },
  }[tone]

  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones.bg} ${tones.text} ring-1 ${tones.ring}`}
        >
          {icon}
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-neutral-900">{value}</span>
        <span className="text-sm font-medium text-neutral-500">{unit}</span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString()
}
