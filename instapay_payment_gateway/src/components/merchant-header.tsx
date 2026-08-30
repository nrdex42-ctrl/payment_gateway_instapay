'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Menu,
  Clock,
  Bell,
  Sparkles,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  X,
} from 'lucide-react'
import { DashboardTab } from './merchant-sidebar'

export interface MerchantNotificationItem {
  id: string
  title: string
  message: string
  severity: string
  createdAt: string
  readAt?: string | null
}

interface MerchantHeaderProps {
  activeTab: DashboardTab
  onOpenMobileMenu: () => void
  egyptTime?: string | null
  dstActive?: boolean
  notifications?: MerchantNotificationItem[]
  onMarkNotificationRead?: (id: string) => void
  onMarkAllNotificationsRead?: () => void
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

function timeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function MerchantHeader({
  activeTab,
  onOpenMobileMenu,
  egyptTime,
  dstActive,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onQuickSimulate,
  isCollapsed,
}: MerchantHeaderProps) {
  const current = tabTitles[activeTab] || tabTitles.monitor
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const unreadCount = notifications.filter((n) => !n.readAt).length

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'URGENT':
        return {
          icon: <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />,
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        }
      case 'WARNING':
        return {
          icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        }
      case 'SUCCESS':
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        }
      default:
        return {
          icon: <Info className="h-3.5 w-3.5 text-sky-400" />,
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        }
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#070a12]/90 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
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

      {/* Right / End: Live Clock, Simulator CTA, Notifications Dropdown, and Language */}
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

        {/* Notifications Bell Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
              dropdownOpen
                ? 'border-violet-500/50 bg-violet-600/20 text-white shadow-sm shadow-violet-900/30'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Notifications"
            aria-expanded={dropdownOpen}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-black text-white shadow-sm shadow-violet-900/50 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Floating Dropdown Panel */}
          {dropdownOpen && (
            <div className="absolute end-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-[#0e1628]/95 backdrop-blur-2xl p-4 shadow-2xl shadow-black/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-extrabold text-violet-300">
                      {unreadCount} unread
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                      All read
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && onMarkAllNotificationsRead && (
                    <button
                      onClick={() => onMarkAllNotificationsRead()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    onClick={() => setDropdownOpen(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pe-1 scrollbar-thin scrollbar-thumb-slate-800">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
                      <Bell className="h-5 w-5 opacity-40" />
                    </div>
                    <p className="text-xs text-slate-400">No notifications received yet.</p>
                    <p className="text-[10px] text-slate-400">System alerts and detector updates will appear here.</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const sev = getSeverityBadge(n.severity)
                    const isUnread = !n.readAt

                    return (
                      <div
                        key={n.id}
                        onClick={() => onMarkNotificationRead && onMarkNotificationRead(n.id)}
                        className={`group relative rounded-xl border p-3 transition-all cursor-pointer ${
                          isUnread
                            ? 'bg-slate-900/90 border-slate-700/80 hover:bg-slate-850'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">{sev.icon}</div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                                {n.title}
                              </span>
                              <span className={`shrink-0 rounded-full border px-1.5 py-0.2 text-[9px] font-bold uppercase ${sev.badge}`}>
                                {n.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                              {n.message}
                            </p>
                            <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-400 font-medium">
                              <span>{timeAgo(n.createdAt)}</span>
                              {isUnread && (
                                <span className="flex items-center gap-1 text-violet-400 font-semibold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                                  Unread
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Language switch slot */}
        <div data-language-toggle-slot className="flex items-center" />
      </div>
    </header>
  )
}
