'use client'

import React from 'react'
import {
  Menu,
  Radio,
  Clock,
  Bell,
  Sparkles,
  ExternalLink,
  Zap,
} from 'lucide-react'
import { DashboardTab } from './merchant-sidebar'

interface MerchantHeaderProps {
  activeTab: DashboardTab
  onOpenMobileMenu: () => void
  egyptTime?: string | null
  dstActive?: boolean
  unreadNotifications?: number
  onOpenNotifications?: () => void
  onQuickSimulate?: () => void
  isCollapsed?: boolean
}

const tabTitles: Record<DashboardTab, { title: string; subtitle: string }> = {
  monitor: {
    title: 'Live Monitor & Diagnostics',
    subtitle: 'Real-time detection pipeline, listener APK, matching engine, and volume metrics.',
  },
  tools: {
    title: 'Developer Simulator & Tools',
    subtitle: 'Simulate checkout sessions, test webhook endpoints, and inspect API credentials.',
  },
  integration: {
    title: 'API & Webhook Integration',
    subtitle: 'Production code snippets and webhook signature verification.',
  },
  billing: {
    title: 'Subscription & Plan Quotas',
    subtitle: 'Manage monthly limits, track usage, upgrade tier, and renew subscriptions.',
  },
  transactions: {
    title: 'Transactions & Reconciliation',
    subtitle: 'Search, filter, inspect metadata, and export confirmed payment records.',
  },
  webhooks: {
    title: 'Webhook Delivery Logs',
    subtitle: 'Audit payloads, HTTP status codes, delivery latencies, and retry failed webhooks.',
  },
}

export function MerchantHeader({
  activeTab,
  onOpenMobileMenu,
  egyptTime,
  dstActive,
  unreadNotifications = 0,
  onOpenNotifications,
  onQuickSimulate,
  isCollapsed,
}: MerchantHeaderProps) {
  const current = tabTitles[activeTab] || tabTitles.monitor

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#070a12]/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
      {/* Left / Start: Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
        <button
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden transition"
          aria-label="Open sidebar menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col truncate">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
              {current.title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gateway Live
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-300 truncate">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Right / End: Live Clock, Simulator CTA, Notifications, and Language */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Egypt Clock */}
        {egyptTime && (
          <div className="hidden xl:flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
            <Clock className="h-3.5 w-3.5 text-violet-400" />
            <span className="font-mono text-[11px] text-slate-300 font-bold">{egyptTime}</span>
            <span className="text-[10px] font-semibold text-slate-400">EGY{dstActive ? ' · DST' : ''}</span>
          </div>
        )}

        {/* Quick Simulator Action */}
        {onQuickSimulate && (
          <button
            onClick={onQuickSimulate}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/10 px-3 py-1.5 text-xs font-bold text-violet-300 hover:bg-violet-600/20 hover:text-white transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simulate Payment</span>
          </button>
        )}

        {/* Notifications Bell with unread badge */}
        {onOpenNotifications && (
          <button
            onClick={onOpenNotifications}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-black text-white shadow-sm shadow-violet-900/50">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
        )}

        {/* Language switch slot */}
        <div data-language-toggle-slot className="flex items-center" />
      </div>
    </header>
  )
}
