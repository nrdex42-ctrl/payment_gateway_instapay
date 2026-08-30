'use client'

import React from 'react'
import Link from 'next/link'
import {
  Radio,
  History,
  Send,
  Terminal,
  Code2,
  BookOpen,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Key,
  ShieldCheck,
  Zap,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react'

export type DashboardTab = 'monitor' | 'tools' | 'integration' | 'billing' | 'transactions' | 'webhooks'

interface ClientSession {
  id: string
  slug: string
  businessName: string
  instapayHandle: string
  email: string
  detectToken: string | null
  subscriptionPlan: string
  isFreeTrial: boolean
  txLimit: number
  txCount: number
}

interface MerchantSidebarProps {
  activeTab: DashboardTab
  onSelectTab: (tab: DashboardTab) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
  client: ClientSession | null
  pendingTxCount?: number
  onOpenSettings?: () => void
  onLogout?: () => void
  onCopyDetectToken?: () => void
  copiedToken?: boolean
}

export function MerchantSidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  client,
  pendingTxCount = 0,
  onOpenSettings,
  onLogout,
  onCopyDetectToken,
  copiedToken,
}: MerchantSidebarProps) {
  const navSections = [
    {
      groupKey: 'core',
      groupLabel: 'Core Engine',
      items: [
        {
          id: 'monitor' as DashboardTab,
          label: 'Live Monitor',
          desc: 'Processes & Engine',
          icon: <Radio className="h-4 w-4" />,
          badge: 'Live',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        },
        {
          id: 'transactions' as DashboardTab,
          label: 'Transactions History',
          desc: 'Records & Confirmation',
          icon: <History className="h-4 w-4" />,
          badge: pendingTxCount > 0 ? `${pendingTxCount}` : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        },
        {
          id: 'webhooks' as DashboardTab,
          label: 'Webhook Logs',
          desc: 'Delivery History',
          icon: <Send className="h-4 w-4" />,
        },
      ],
    },
    {
      groupKey: 'dev',
      groupLabel: 'Developer Tools',
      items: [
        {
          id: 'tools' as DashboardTab,
          label: 'Testing & Simulator',
          desc: 'Test Payment & Webhooks',
          icon: <Terminal className="h-4 w-4" />,
        },
        {
          id: 'integration' as DashboardTab,
          label: 'API & Integration',
          desc: 'Code Snippets & Secrets',
          icon: <Code2 className="h-4 w-4" />,
        },
      ],
    },
    {
      groupKey: 'billing',
      groupLabel: 'Subscription & Plans',
      items: [
        {
          id: 'billing' as DashboardTab,
          label: 'Plan, Quotas & Renewal',
          desc: `${client?.txCount ?? 0}/${client?.txLimit ?? 0} used`,
          icon: <CreditCard className="h-4 w-4" />,
          badge: client?.isFreeTrial ? 'Trial' : client?.subscriptionPlan?.toUpperCase(),
          badgeColor: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
        },
      ],
    },
  ]

  const quotaPercent = client && client.txLimit > 0
    ? Math.min(100, Math.round((client.txCount / client.txLimit) * 100))
    : 0

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 z-50 flex flex-col border-e border-slate-800/80 bg-[#0b101e]/95 backdrop-blur-xl transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'start-0 translate-x-0 shadow-2xl shadow-violet-950/40' : 'max-lg:-translate-x-full lg:start-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/70 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-md shadow-violet-900/30">
              <Zap className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                  InstaPay
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.2 text-[9px] font-bold text-violet-300">
                    GATEWAY
                  </span>
                </span>
                <span className="text-[10px] text-slate-300 truncate">
                  {client?.businessName || 'Merchant Portal'}
                </span>
              </div>
            )}
          </div>

          {/* Collapse Toggle Button (Desktop) & Close Button (Mobile) */}
          <div className="flex items-center">
            <button
              onClick={onCloseMobile}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Close mobile menu"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              ) : (
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Items Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {navSections.map((section) => (
            <div key={section.groupKey} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                  {section.groupLabel}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id)
                      onCloseMobile()
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/10 border border-violet-500/40 text-white shadow-sm shadow-violet-950/20'
                        : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isActive
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                          : 'bg-slate-900/80 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800'
                      }`}
                    >
                      {item.icon}
                    </span>

                    {!isCollapsed && (
                      <div className="flex flex-1 items-center justify-between overflow-hidden">
                        <div className="truncate">
                          <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                            {item.label}
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">
                            {item.desc}
                          </div>
                        </div>

                        {item.badge && (
                          <span
                            className={`ms-2 shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                              item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Active side indicator */}
                    {isActive && (
                      <span className="absolute start-0 top-2 bottom-2 w-1 rounded-e-full bg-violet-500" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {/* Guide Link */}
          <div className="pt-2 border-t border-slate-800/60">
            <Link
              href="/dashboard/guide"
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition"
              title={isCollapsed ? 'Integration Guide' : undefined}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/80 text-slate-400 group-hover:text-slate-200">
                <BookOpen className="h-4 w-4" />
              </span>
              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-300">Integration Guide</div>
                    <div className="text-[10px] text-slate-300">Interactive setup</div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </div>
              )}
            </Link>
          </div>
        </div>

        {/* Merchant Profile & Quota Footer */}
        <div className="border-t border-slate-800/80 bg-slate-950/40 p-3">
          {!isCollapsed ? (
            <div className="space-y-3">
              {/* Quota bar */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-400">Monthly Quota</span>
                  <span className="font-mono font-bold text-violet-300">{quotaPercent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quotaPercent >= 90
                        ? 'bg-rose-500'
                        : quotaPercent >= 75
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-violet-500 to-indigo-500'
                    }`}
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] text-slate-300 text-end">
                  {client?.txCount ?? 0} / {client?.txLimit ?? 0} tx
                </div>
              </div>

              {/* Account details & quick actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-300 font-bold text-xs">
                    {client?.businessName ? client.businessName.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-white truncate">
                      {client?.businessName || 'Merchant'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 truncate">
                      @{client?.instapayHandle || 'handle'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onCopyDetectToken && (
                    <button
                      onClick={onCopyDetectToken}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                      title={copiedToken ? 'Copied' : 'Copy APK Token'}
                    >
                      {copiedToken ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Key className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      onClick={onOpenSettings}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                      title="Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  )}
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="rounded-lg p-1.5 text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400 transition"
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-300 font-bold text-sm">
                {client?.businessName ? client.businessName.charAt(0).toUpperCase() : 'M'}
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="rounded-lg p-1.5 text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
