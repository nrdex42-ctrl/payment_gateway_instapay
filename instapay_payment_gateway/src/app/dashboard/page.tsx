'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Key,
  LogOut,
  RefreshCw,
  Terminal,
  TrendingUp,
  Wallet,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle,
  CreditCard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ClientSession {
  id: string
  slug: string
  businessName: string
  instapayHandle: string
  instapayPaymentUrl: string | null
  email: string
  apiKey: string | null
  detectToken: string | null
  webhookUrl: string | null
  webhookSecret: string | null
  checkoutTtlMin: number
  createdAt: string
  subscriptionPlan: string
  subscriptionEndsAt: string | null
  isFreeTrial: boolean
  txLimit: number
  txCount: number
}

interface DashboardStats {
  today: { count: number; totalEgp: number }
  sevenDays: { count: number; totalEgp: number }
  pending: { count: number; totalEgp: number }
}

interface RecentTx {
  sessionId: string
  senderHandle: string
  recipientHandle: string
  amountEgp: number
  currency: string
  status: string
  detectedRef: string | null
  detectedAtEgypt: string | null
  createdAt: string
}

interface TransactionLog extends RecentTx {
  createdAtEgypt?: string
}

interface WebhookLog {
  id: string
  event: string
  url: string
  isSuccess: boolean
  statusCode: number | null
  payload: string
  response: string | null
  createdAt: string
}

interface Snippets {
  curl: string
  javascript: string
  python: string
  php: string
  nodeWebhook: string
}

interface Plan {
  id: string
  name: string
  priceEgp: number
  maxTransactions: number
}

interface SubscriptionCheckout {
  sessionId: string
  planName: string
  amountEgp: number
  currency: string
  senderHandle: string
  recipientHandle: string
  deepLinkUrl: string
  qrCodeDataUrl: string
  status: string
  expiresAt: string
}

type DashboardTab = 'integration' | 'billing' | 'transactions' | 'webhooks'

const tabItems: Array<{ id: DashboardTab; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'integration', label: 'Developers', description: 'API keys, webhooks, checkout setup', icon: <Key className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', description: 'Plans, quota, subscription checkout', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'transactions', label: 'Transactions', description: 'Search, filter, export history', icon: <Activity className="h-4 w-4" /> },
  { id: 'webhooks', label: 'Webhooks', description: 'Delivery attempts and failures', icon: <Globe className="h-4 w-4" /> },
]

function formatEgp(value: number) {
  return new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function formatShortDate(value: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function maskSecret(value: string | null | undefined) {
  if (!value) return 'Not generated'
  if (value.length <= 12) return '••••••••'
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`
}

function safeJsonFormat(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value || 'No payload captured.'
  }
}

export default function MerchantDashboardPage() {
  const router = useRouter()
  
  // Auth state
  const [client, setClient] = useState<ClientSession | null>(null)
  const [loading, setLoading] = useState(true)

  // Dashboard state
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTx, setRecentTx] = useState<RecentTx[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [snippets, setSnippets] = useState<Snippets | null>(null)
  const [selectedSnippetTab, setSelectedSnippetTab] = useState<keyof Snippets>('curl')

  // Integration settings form state
  const [instapayHandleInput, setInstapayHandleInput] = useState('')
  const [webhookUrlInput, setWebhookUrlInput] = useState('')
  const [instapayPaymentUrlInput, setInstapayPaymentUrlInput] = useState('')
  const [checkoutTtlInput, setCheckoutTtlInput] = useState('10')
  const [updatingSettings, setUpdatingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSuccess, setSettingsSuccess] = useState(false)

  // Copy state
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  // Advanced features states
  const [activeTab, setActiveTab] = useState<DashboardTab>('integration')
  const [allTransactions, setAllTransactions] = useState<TransactionLog[]>([])
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptionCheckout, setSubscriptionCheckout] = useState<SubscriptionCheckout | null>(null)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [billingLoadingPlan, setBillingLoadingPlan] = useState<string | null>(null)
  const [txFilters, setTxFilters] = useState({ q: '', status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '' })
  const [webhookFilters, setWebhookFilters] = useState({ success: '' })
  const [txLoading, setTxLoading] = useState(false)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [selectedLogDetail, setSelectedLogDetail] = useState<WebhookLog | null>(null)
  const integrationSectionRef = useRef<HTMLDivElement | null>(null)

  const loadTransactions = async () => {
    if (!client) return
    setTxLoading(true)
    try {
      const headers = { Authorization: `Bearer ${client.apiKey}` }
      const params = new URLSearchParams()
      params.set('clientId', client.id)
      if (txFilters.q) params.set('q', txFilters.q)
      if (txFilters.status) params.set('status', txFilters.status)
      if (txFilters.minAmount) params.set('minAmount', txFilters.minAmount)
      if (txFilters.maxAmount) params.set('maxAmount', txFilters.maxAmount)
      if (txFilters.startDate) params.set('startDate', txFilters.startDate)
      if (txFilters.endDate) params.set('endDate', txFilters.endDate)

      const res = await fetch(`/api/transactions?${params.toString()}`, { headers })
      const data = await res.json()
      if (data.ok) {
        setAllTransactions(data.transactions)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setTxLoading(false)
    }
  }

  const loadWebhookLogs = async () => {
    if (!client) return
    setWebhookLoading(true)
    try {
      const headers = { Authorization: `Bearer ${client.apiKey}` }
      const params = new URLSearchParams()
      if (webhookFilters.success) params.set('success', webhookFilters.success)

      const res = await fetch(`/api/dashboard/webhooks?${params.toString()}`, { headers })
      const data = await res.json()
      if (data.ok) {
        setWebhookLogs(data.logs)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setWebhookLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!client) return
    const params = new URLSearchParams()
    params.set('clientId', client.id)
    if (txFilters.q) params.set('q', txFilters.q)
    if (txFilters.status) params.set('status', txFilters.status)
    if (txFilters.minAmount) params.set('minAmount', txFilters.minAmount)
    if (txFilters.maxAmount) params.set('maxAmount', txFilters.maxAmount)
    if (txFilters.startDate) params.set('startDate', txFilters.startDate)
    if (txFilters.endDate) params.set('endDate', txFilters.endDate)

    fetch(`/api/transactions/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${client.apiKey}` }
    })
    .then(async (res) => {
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions_export_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
    })
    .catch((err) => {
      console.error(err)
      alert('Failed to export transactions.')
    })
  }

  const loadDashboardData = async () => {
    if (!client) return
    setRefreshing(true)
    try {
      const headers = { Authorization: `Bearer ${client.apiKey}` }
      const res = await fetch(`/api/dashboard?clientId=${client.id}`, { headers })
      const data = await res.json()
      if (data.ok) {
        setStats(data.stats)
        setRecentTx(data.recent)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }

  const loadSnippets = async () => {
    try {
      const res = await fetch('/api/v1/integration/snippets')
      const data = await res.json()
      if (data.ok) {
        setSnippets(data.snippets)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadPlans = async () => {
    try {
      const res = await fetch('/api/plans')
      const data = await res.json()
      if (data.ok) setPlans(data.plans)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubscribe = async (planName: string) => {
    setBillingError(null)
    setBillingLoadingPlan(planName)
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName }),
      })
      const data = await res.json()
      if (data.ok) {
        setSubscriptionCheckout(data.checkout)
      } else {
        setBillingError(data.error || 'Failed to create subscription checkout.')
      }
    } catch {
      setBillingError('Connection error.')
    } finally {
      setBillingLoadingPlan(null)
    }
  }

  useEffect(() => {
    if (!subscriptionCheckout || subscriptionCheckout.status !== 'PENDING') return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/subscription/status?sessionId=${subscriptionCheckout.sessionId}`)
        const data = await res.json()
        if (data.ok) {
          setSubscriptionCheckout((prev) => prev ? { ...prev, ...data.checkout } : prev)
          if (data.checkout.status === 'CONFIRMED') {
            const sessionRes = await fetch('/api/auth/session')
            const sessionData = await sessionRes.json()
            if (sessionData.ok) setClient(sessionData.client)
            loadDashboardData()
          }
        }
      } catch (err) {
        console.error(err)
      }
    }, 5000)
    return () => clearInterval(id)
  }, [subscriptionCheckout?.sessionId, subscriptionCheckout?.status])

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSettingsError(null)
    setSettingsSuccess(false)
    setUpdatingSettings(true)
    try {
      const res = await fetch('/api/auth/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instapayHandle: instapayHandleInput || null,
          webhookUrl: webhookUrlInput || null,
          instapayPaymentUrl: instapayPaymentUrlInput || null,
          checkoutTtlMin: parseInt(checkoutTtlInput) || 10,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setClient(data.client)
        setSettingsSuccess(true)
        setTimeout(() => setSettingsSuccess(false), 3000)
      } else {
        setSettingsError(data.error || 'Failed to update settings.')
      }
    } catch {
      setSettingsError('Connection error.')
    } finally {
      setUpdatingSettings(false)
    }
  }

  const handleRegenerateToken = async (type: 'apiKey' | 'detectToken' | 'webhookSecret') => {
    if (!confirm(`Are you sure you want to regenerate this integration key? Previous applications using it will lose access.`)) return
    try {
      const payload: Record<string, boolean> = {}
      if (type === 'apiKey') payload.regenerateApiKey = true
      if (type === 'detectToken') payload.regenerateDetectToken = true
      if (type === 'webhookSecret') payload.regenerateWebhookSecret = true

      const res = await fetch('/api/auth/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        setClient(data.client)
        loadDashboardData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (err) {
      console.error(err)
    }
  }

  const openIntegrationSetup = () => {
    setActiveTab('integration')
    window.setTimeout(() => {
      integrationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      integrationSectionRef.current?.focus({ preventScroll: true })
    }, 80)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (data.ok) {
          setClient(data.client)
          setInstapayHandleInput(data.client.instapayHandle || '')
          setWebhookUrlInput(data.client.webhookUrl || '')
          setInstapayPaymentUrlInput(data.client.instapayPaymentUrl || '')
          setCheckoutTtlInput(String(data.client.checkoutTtlMin || 10))
        } else {
          router.push('/login')
        }
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [router])

  useEffect(() => {
    if (client) {
      loadDashboardData()
      loadSnippets()
      loadPlans()
    }
  }, [client])

  useEffect(() => {
    if (client) {
      if (activeTab === 'transactions') {
        loadTransactions()
      } else if (activeTab === 'webhooks') {
        loadWebhookLogs()
      }
    }
  }, [activeTab, client])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070a12] text-neutral-400">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
            <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
          </div>
          <RefreshCw className="h-5 w-5 animate-spin text-violet-400 mx-auto" />
          <p className="text-xs">Validating secure merchant session…</p>
        </div>
      </div>
    )
  }

  if (!client) return null

  const setupItems = [
    {
      label: 'Receiving InstaPay handle',
      done: Boolean(client.instapayHandle && !client.instapayHandle.startsWith(`${client.slug}@`)),
      hint: client.instapayHandle || 'Not configured',
    },
    {
      label: 'Static InstaPay payment URL',
      done: Boolean(client.instapayPaymentUrl),
      hint: client.instapayPaymentUrl ? 'Configured' : 'Required for checkout payment links',
    },
    {
      label: 'Webhook endpoint',
      done: Boolean(client.webhookUrl),
      hint: client.webhookUrl ? 'Configured' : 'Add your HTTPS confirmation endpoint',
    },
    {
      label: 'Webhook signing secret',
      done: Boolean(client.webhookSecret),
      hint: client.webhookSecret ? 'Generated' : 'Generate before production fulfillment',
    },
  ]
  const completedSetupItems = setupItems.filter((item) => item.done).length
  const setupComplete = completedSetupItems === setupItems.length
  const usagePercent = client.txLimit > 0 ? Math.min(100, (client.txCount / client.txLimit) * 100) : 0
  const quotaState = client.txLimit > 0 && client.txCount >= client.txLimit
    ? 'limit-reached'
    : client.txLimit > 0 && client.txCount >= client.txLimit * 0.8
    ? 'near-limit'
    : 'healthy'
  const subscriptionLabel = client.subscriptionPlan.replaceAll('_', ' ')
  const displaySlug = client.slug?.trim()

  return (
    <div className="min-h-screen bg-[#070a12] text-neutral-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg shadow-indigo-950/40">
              <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-white">{client.businessName}</h1>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300 border border-emerald-500/30">
                  Approved
                </span>
              </div>
              <p className="truncate text-xs text-neutral-500">
                Merchant console
                {displaySlug && (
                  <>
                    {' · '}
                    <span className="font-semibold text-neutral-400">/{displaySlug}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={refreshing}
              className="rounded-xl text-neutral-300 border-white/10 bg-white/[0.03] hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div data-language-toggle-slot data-i18n-skip />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-xl text-neutral-500 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-5 sm:px-6 sm:py-6 space-y-5 sm:space-y-6">
        <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.28),transparent_34%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,6,23,.92))] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-6">
          <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
                <Activity className="h-3.5 w-3.5" />
                Live merchant operations
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                Payments, billing, and integrations in one workspace.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                Monitor confirmation volume, manage the Android listener integration, subscribe to gateway plans, and troubleshoot webhook delivery from a single control plane.
              </p>
            </div>

            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-3 lg:max-w-xl">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Plan</div>
                <div className="mt-2 text-sm font-black text-white">{subscriptionLabel}</div>
                <div className="mt-1 text-xs text-slate-500">{client.isFreeTrial ? 'Free trial' : 'Active merchant'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Setup</div>
                <div className="mt-2 text-sm font-black text-white">{completedSetupItems}/{setupItems.length} complete</div>
                <div className={`mt-1 text-xs ${setupComplete ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {setupComplete ? 'Production ready' : 'Action needed'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Quota</div>
                <div className={`mt-2 text-sm font-black ${quotaState === 'limit-reached' ? 'text-red-300' : quotaState === 'near-limit' ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {quotaState === 'limit-reached' ? 'Limit reached' : quotaState === 'near-limit' ? 'Near limit' : 'Healthy'}
                </div>
                <div className="mt-1 text-xs text-slate-500">{client.txCount.toLocaleString()} / {client.txLimit.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </section>
        {/* Merchant setup checklist */}
        <div className={`rounded-2xl border p-5 ${
          setupComplete
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-indigo-500/20 bg-indigo-500/5'
        }`}>
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-5 w-5 ${setupComplete ? 'text-emerald-400' : 'text-indigo-300'}`} />
                <h2 className="text-base font-bold text-white">
                  {setupComplete ? 'Gateway setup complete' : 'Complete your gateway setup'}
                </h2>
              </div>
              <p className="max-w-2xl text-xs leading-6 text-neutral-400">
                Signup only creates your merchant account. Configure the operational details here before sending production checkout traffic.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm font-bold text-white">
              {completedSetupItems} / {setupItems.length} completed
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {setupItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-xs font-bold text-neutral-200">{item.label}</span>
                </div>
                <p className="mt-2 truncate text-[10px] text-neutral-500">{item.hint}</p>
              </div>
            ))}
          </div>

          {!setupComplete && (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={openIntegrationSetup}
                className="rounded-xl bg-indigo-500 text-white hover:bg-indigo-400"
              >
                Open integration setup
              </Button>
            </div>
          )}
        </div>

        {/* Subscription Usage Banner */}
        <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-4 sm:p-5 flex min-w-0 flex-col md:flex-row items-stretch md:items-center justify-between gap-5 md:gap-6">
          <div className="space-y-1.5 flex-1 w-full">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight uppercase">
                Plan: <span className="text-violet-400 font-extrabold">{subscriptionLabel}</span>
              </h2>
              {client.isFreeTrial && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 border border-amber-500/20">
                  Free Trial
                </span>
              )}
            </div>
            
            <p className="text-xs text-neutral-400">
              {client.subscriptionEndsAt
                ? (() => {
                    const endDate = new Date(client.subscriptionEndsAt!)
                    const remainMs = endDate.getTime() - Date.now()
                    const remainDays = Math.ceil(remainMs / (1000 * 60 * 60 * 24))
                    if (remainDays > 0) {
                      return `Expires on ${formatShortDate(client.subscriptionEndsAt)} — ${remainDays} day${remainDays !== 1 ? 's' : ''} remaining`
                    }
                    return `Expired on ${formatShortDate(client.subscriptionEndsAt)}`
                  })()
                : 'Unlimited plan expiration'}
            </p>

            {/* Progress Bar Container */}
            <div className="pt-2 w-full max-w-md">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-1">
                <span className="text-neutral-500 font-medium">Confirmed Transactions</span>
                <span className="font-bold text-neutral-300">
                  {client.txCount.toLocaleString()} / {client.txLimit.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    quotaState === 'limit-reached'
                      ? 'bg-red-500'
                      : quotaState === 'near-limit'
                      ? 'bg-amber-500'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-500'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {quotaState === 'limit-reached' && (
                <p className="text-[10px] text-red-400 pt-1">
                  Your quota is fully used. Subscribe to a higher plan or renew from Billing.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch md:items-end space-y-1 bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-center md:text-right shrink-0">
            <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Monthly billing</span>
            <button type="button" onClick={() => setActiveTab('billing')} className="text-xs text-violet-300 hover:text-violet-200">
              View plans and renew quota
            </button>
            <span className="text-sm font-bold text-white pt-1">{client.subscriptionPlan === 'BASIC' ? '200 EGP / month' : client.subscriptionPlan === 'PRO' ? '500 EGP / month' : client.subscriptionPlan === 'ENTERPRISE' ? '700 EGP / month' : 'Free'}</span>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Today's Confirmed"
              value={formatEgp(stats.today.totalEgp)}
              unit="EGP"
              sub={`${stats.today.count} payments confirmed`}
              tone="emerald"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Last 7 Days"
              value={formatEgp(stats.sevenDays.totalEgp)}
              unit="EGP"
              sub={`${stats.sevenDays.count} payments confirmed`}
              tone="violet"
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Pending"
              value={formatEgp(stats.pending.totalEgp)}
              unit="EGP"
              sub={`${stats.pending.count} transactions awaiting confirmation`}
              tone="amber"
            />
          </div>
        )}

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Navigable Tabs System */}
          <div className="lg:col-span-2 space-y-5">
            {/* Tabs Navigation */}
            <div ref={integrationSectionRef} tabIndex={-1} className="scroll-mt-28 grid gap-2 border-b border-neutral-900 pb-3 outline-none sm:grid-cols-2 xl:grid-cols-4">
              {tabItems.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                    activeTab === t.id
                      ? 'bg-violet-600/10 border-violet-500/60 text-violet-200 shadow-lg shadow-violet-950/20'
                      : 'text-neutral-500 border-neutral-900 bg-neutral-900/20 hover:text-neutral-300 hover:bg-neutral-900/50'
                  }`}
                >
                  <span className={`mt-0.5 ${activeTab === t.id ? 'text-violet-300' : 'text-neutral-500'}`}>{t.icon}</span>
                  <span>
                    <span className="block text-xs font-black tracking-wide">{t.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-neutral-500">{t.description}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* TAB CONTENTS */}
            
            {/* Tab: Developer Integration */}
            {activeTab === 'integration' && (
              <div className="space-y-6">
                {/* Integration Keys Card */}
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-neutral-400" />
                    <h2 className="text-base font-bold text-white">API Integration Credentials</h2>
                  </div>

                  <div className="space-y-3 bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-xs">
                    {/* API Key */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1">
                          API Key (`apiKey`)
                        </span>
                        <p className="text-[10px] text-neutral-500">Bearer token for generating checkouts from your backend server.</p>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 font-mono text-neutral-300">
                        <span className="truncate rounded-lg border border-neutral-800 bg-neutral-900/70 px-2 py-1 text-[11px] select-all">{maskSecret(client.apiKey)}</span>
                        <button
                          onClick={() => copyToClipboard(client.apiKey || '', 'api-key')}
                          className="text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {copiedLabel === 'api-key' && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
                        <button
                          onClick={() => handleRegenerateToken('apiKey')}
                          className="text-[10px] text-neutral-600 hover:text-neutral-400 underline font-sans ml-1"
                        >
                          Regen
                        </button>
                      </div>
                    </div>

                    {/* APK detectToken */}
                    <div className="flex flex-col gap-3 border-t border-neutral-900/60 pt-3 mt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1">
                          APK Token (`detectToken`)
                        </span>
                        <p className="text-[10px] text-neutral-500">Configure inside your Android Notification listener APK.</p>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 font-mono text-neutral-300">
                        <span className="truncate rounded-lg border border-neutral-800 bg-neutral-900/70 px-2 py-1 text-[11px] select-all">{maskSecret(client.detectToken)}</span>
                        <button
                          onClick={() => copyToClipboard(client.detectToken || '', 'detect-token')}
                          className="text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {copiedLabel === 'detect-token' && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
                        <button
                          onClick={() => handleRegenerateToken('detectToken')}
                          className="text-[10px] text-neutral-600 hover:text-neutral-400 underline font-sans ml-1"
                        >
                          Regen
                        </button>
                      </div>
                    </div>

                    {/* Webhook Secret */}
                    <div className="flex flex-col gap-3 border-t border-neutral-900/60 pt-3 mt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1">
                          Webhook Secret (`webhookSecret`)
                        </span>
                        <p className="text-[10px] text-neutral-500">HMAC-SHA256 secret key for signing payloads forwarded to your server.</p>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 font-mono text-neutral-300">
                        <span className="truncate rounded-lg border border-neutral-800 bg-neutral-900/70 px-2 py-1 text-[11px] select-all">{maskSecret(client.webhookSecret)}</span>
                        <button
                          onClick={() => copyToClipboard(client.webhookSecret || '', 'webhook-secret')}
                          className="text-neutral-500 hover:text-neutral-300 transition-colors"
                          disabled={!client.webhookSecret}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {copiedLabel === 'webhook-secret' && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
                        <button
                          onClick={() => handleRegenerateToken('webhookSecret')}
                          className="text-[10px] text-neutral-600 hover:text-neutral-400 underline font-sans ml-1"
                        >
                          {client.webhookSecret ? 'Regen' : 'Generate'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Link & Webhook Settings */}
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-neutral-400" />
                    <h2 className="text-base font-bold text-white">Payment Link & Webhook Settings</h2>
                  </div>

                  <form onSubmit={handleUpdateSettings} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="instapayHandle" className="text-xs text-neutral-400">
                        Receiving InstaPay Handle
                      </Label>
                      <Input
                        id="instapayHandle"
                        type="text"
                        placeholder="youraccount@instapay"
                        value={instapayHandleInput}
                        onChange={(e) => setInstapayHandleInput(e.target.value)}
                        className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                      />
                      <p className="text-[10px] text-neutral-500">
                        This is the InstaPay account that receives customer transfers. You can enter either <span className="font-mono">youraccount</span> or <span className="font-mono">youraccount@instapay</span>.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="instapayPaymentUrl" className="text-xs text-neutral-400">
                        Static InstaPay Payment URL
                      </Label>
                      <Input
                        id="instapayPaymentUrl"
                        type="url"
                        placeholder="https://ipn.eg/S/youraccount/instapay/1QduWC"
                        value={instapayPaymentUrlInput}
                        onChange={(e) => setInstapayPaymentUrlInput(e.target.value)}
                        className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                      />
                      <p className="text-[10px] text-neutral-500">
                        Paste the exact payment/share link from your InstaPay APK. The gateway reuses this URL unchanged for every checkout.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1.5">
                        <Label htmlFor="webhookUrl" className="text-xs text-neutral-400">
                          Webhook URL (Gateway POSTs confirmed payments here)
                        </Label>
                        <Input
                          id="webhookUrl"
                          type="url"
                          placeholder="https://yourserver.com/api/webhooks/payment"
                          value={webhookUrlInput}
                          onChange={(e) => setWebhookUrlInput(e.target.value)}
                          className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="checkoutTtl" className="text-xs text-neutral-400">
                          Checkout Expiration (Mins)
                        </Label>
                        <Input
                          id="checkoutTtl"
                          type="number"
                          min="1"
                          max="180"
                          value={checkoutTtlInput}
                          onChange={(e) => setCheckoutTtlInput(e.target.value)}
                          className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white focus-visible:ring-violet-500"
                        />
                      </div>
                    </div>

                    {settingsError && (
                      <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-2 text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{settingsError}</span>
                      </div>
                    )}

                    {settingsSuccess && (
                      <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Settings saved successfully.</span>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updatingSettings}
                        className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold px-6"
                      >
                        {updatingSettings ? 'Saving…' : 'Save Settings'}
                      </Button>
                    </div>
                  </form>
                </div>

                {/* SDK Code Snippets */}
                {snippets && (
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-neutral-400" />
                      <h2 className="text-base font-bold text-white">Integration Documentation</h2>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-neutral-900 pb-2">
                      {(Object.keys(snippets) as Array<keyof Snippets>).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setSelectedSnippetTab(tab)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                            selectedSnippetTab === tab
                              ? 'bg-neutral-800 text-white border border-neutral-700'
                              : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          {tab === 'nodeWebhook' ? 'Node Webhook' : tab}
                        </button>
                      ))}
                    </div>

                    {/* Code Block */}
                    <div className="relative">
                      <pre className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-72">
                        <code>
                          {snippets[selectedSnippetTab]
                            .replace('YOUR_API_KEY', client.apiKey || 'YOUR_API_KEY')}
                        </code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(snippets[selectedSnippetTab].replace('YOUR_API_KEY', client.apiKey || 'YOUR_API_KEY'), 'code')}
                        className="absolute top-2 right-2 h-7 px-2 text-neutral-500 hover:text-white bg-neutral-950/80"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      {copiedLabel === 'code' && (
                        <span className="absolute top-10 right-2 text-[10px] text-emerald-400 font-sans bg-neutral-950 px-2 py-0.5 rounded">
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Plans & Billing */}
            {activeTab === 'billing' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-violet-400" />
                    <h2 className="text-base font-bold text-white">Gateway Pricing</h2>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Subscribe by paying the exact plan price through InstaPay. Once the subscription transaction is confirmed, your monthly quota is activated automatically.
                  </p>
                </div>

                {billingError && (
                  <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{billingError}</span>
                  </div>
                )}

                {subscriptionCheckout && (
                  <div className="rounded-2xl border border-violet-500/30 bg-violet-950/10 p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[minmax(140px,180px)_minmax(0,1fr)] gap-5">
                    <div className="mx-auto w-full max-w-[180px] rounded-xl bg-white p-2 md:max-w-none">
                      <img src={subscriptionCheckout.qrCodeDataUrl} alt="Subscription payment QR" className="w-full h-auto" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold">Pending subscription payment</p>
                        <h3 className="text-xl font-black text-white">{subscriptionCheckout.planName} · {formatEgp(subscriptionCheckout.amountEgp)} {subscriptionCheckout.currency}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                          <p className="text-neutral-500">Pay from</p>
                          <p className="font-mono text-neutral-200 select-all">{subscriptionCheckout.senderHandle}</p>
                        </div>
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                          <p className="text-neutral-500">Pay to</p>
                          <p className="font-mono text-neutral-200 select-all">{subscriptionCheckout.recipientHandle}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild className="bg-violet-600 hover:bg-violet-700 rounded-xl text-white">
                          <a href={subscriptionCheckout.deepLinkUrl} target="_blank" rel="noopener noreferrer">
                            Open InstaPay Link
                          </a>
                        </Button>
                        <span className={`text-xs font-bold ${subscriptionCheckout.status === 'CONFIRMED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {subscriptionCheckout.status === 'CONFIRMED' ? 'Confirmed. Plan activated.' : 'Waiting for confirmation...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.filter((plan) => plan.name !== 'FREE_TRIAL').map((plan) => {
                    const isCurrent = client.subscriptionPlan === plan.name
                    return (
                      <div
                        key={plan.id}
                        className={`rounded-2xl border p-5 space-y-4 ${
                          isCurrent
                            ? 'border-violet-500/50 bg-violet-950/10'
                            : 'border-neutral-900 bg-neutral-900/30'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-black text-white">{plan.name}</h3>
                            {isCurrent && (
                              <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300 font-bold">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-3xl font-black text-white mt-2">
                            {plan.priceEgp.toLocaleString('en-EG')} <span className="text-sm text-neutral-500">EGP / month</span>
                          </p>
                        </div>

                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300">
                          <p><span className="font-bold text-white">{plan.maxTransactions.toLocaleString()}</span> confirmed transactions / month</p>
                          <p className="text-neutral-500 mt-1">Automatic activation after exact payment confirmation.</p>
                        </div>

                        <Button
                          disabled={billingLoadingPlan === plan.name || isCurrent}
                          onClick={() => handleSubscribe(plan.name)}
                          className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50"
                        >
                          {isCurrent ? 'Active Plan' : billingLoadingPlan === plan.name ? 'Creating payment…' : `Subscribe to ${plan.name}`}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tab: Transaction Reports */}
            {activeTab === 'transactions' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/30 p-4 rounded-2xl border border-neutral-900">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white">Transaction Logs</h3>
                    <p className="text-xs text-neutral-500 font-medium">Filter and export your historical client transactions.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleExportCSV}
                    className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl text-xs h-9"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                </div>

                {/* Filters card */}
                <div className="bg-neutral-900/20 border border-neutral-900 p-4 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Keyword</Label>
                      <Input
                        type="text"
                        placeholder="Sender, Ref, Session..."
                        value={txFilters.q}
                        onChange={(e) => setTxFilters({ ...txFilters, q: e.target.value })}
                        className="h-8 text-xs rounded-lg border-neutral-800 bg-neutral-950/80 text-white placeholder-neutral-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Status</Label>
                      <select
                        value={txFilters.status}
                        onChange={(e) => setTxFilters({ ...txFilters, status: e.target.value })}
                        className="w-full h-8 px-2.5 rounded-lg border border-neutral-800 bg-neutral-950/80 text-white text-xs outline-none focus:border-violet-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="PENDING">PENDING</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="EXPIRED">EXPIRED</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Min Amount</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={txFilters.minAmount}
                        onChange={(e) => setTxFilters({ ...txFilters, minAmount: e.target.value })}
                        className="h-8 text-xs rounded-lg border-neutral-800 bg-neutral-950/80 text-white placeholder-neutral-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Max Amount</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={txFilters.maxAmount}
                        onChange={(e) => setTxFilters({ ...txFilters, maxAmount: e.target.value })}
                        className="h-8 text-xs rounded-lg border-neutral-800 bg-neutral-950/80 text-white placeholder-neutral-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Start Date</Label>
                      <Input
                        type="date"
                        value={txFilters.startDate}
                        onChange={(e) => setTxFilters({ ...txFilters, startDate: e.target.value })}
                        className="h-8 text-xs rounded-lg border-neutral-800 bg-neutral-950/80 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">End Date</Label>
                      <Input
                        type="date"
                        value={txFilters.endDate}
                        onChange={(e) => setTxFilters({ ...txFilters, endDate: e.target.value })}
                        className="h-8 text-xs rounded-lg border-neutral-800 bg-neutral-950/80 text-white"
                      />
                    </div>
                    <div className="flex items-end gap-2 sm:col-span-2">
                      <Button
                        size="sm"
                        onClick={loadTransactions}
                        disabled={txLoading}
                        className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex-1"
                      >
                        <Filter className="mr-1 h-3.5 w-3.5" />
                        Apply Filters
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTxFilters({ q: '', status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '' })
                          setTimeout(() => loadTransactions(), 100)
                        }}
                        className="h-8 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white text-xs px-4"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Transactions list */}
                <div className="space-y-2">
                  {txLoading ? (
                    <div className="py-12 text-center text-xs text-neutral-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-violet-500 mb-2" />
                      Loading transactions...
                    </div>
                  ) : allTransactions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-600 border border-neutral-900 rounded-2xl bg-neutral-900/10">
                      No transactions matched the criteria.
                    </div>
                  ) : (
                    allTransactions.map((tx) => (
                      <div
                        key={tx.sessionId}
                        className="rounded-xl border border-neutral-900 bg-neutral-900/30 p-4 flex justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{tx.senderHandle}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                tx.status === 'CONFIRMED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : tx.status === 'PENDING'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 font-mono">
                            Session ID: <span className="select-all text-neutral-400">{tx.sessionId}</span>
                            {tx.detectedRef && ` · Ref: ${tx.detectedRef}`}
                          </p>
                          <p className="text-[9px] text-neutral-600 font-medium">
                            Created: {tx.createdAtEgypt} {tx.detectedAtEgypt && ` · Confirmed: ${tx.detectedAtEgypt}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-white text-sm">+{formatEgp(tx.amountEgp)} EGP</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Webhook Logs */}
            {activeTab === 'webhooks' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-0.5 bg-neutral-900/30 p-4 rounded-2xl border border-neutral-900">
                  <h3 className="text-sm font-bold text-white">Webhook Delivery Log</h3>
                  <p className="text-xs text-neutral-500 font-medium">Troubleshoot your backend callback responses and HTTP status outcomes.</p>
                </div>

                {/* Filters card */}
                <div className="bg-neutral-900/20 border border-neutral-900 p-4 rounded-2xl flex items-end gap-3">
                  <div className="space-y-1 flex-1 min-w-[150px]">
                    <Label className="text-[10px] text-neutral-400 uppercase font-bold">Status</Label>
                    <select
                      value={webhookFilters.success}
                      onChange={(e) => setWebhookFilters({ ...webhookFilters, success: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg border border-neutral-800 bg-neutral-950/80 text-white text-xs outline-none focus:border-violet-500"
                    >
                      <option value="">All Results</option>
                      <option value="true">Success (2xx)</option>
                      <option value="false">Failed</option>
                    </select>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={loadWebhookLogs}
                      disabled={webhookLoading}
                      className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs px-4"
                    >
                      Filter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setWebhookFilters({ success: '' })
                        setTimeout(() => loadWebhookLogs(), 100)
                      }}
                      className="h-8 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white text-xs"
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Webhook logs */}
                <div className="space-y-2">
                  {webhookLoading ? (
                    <div className="py-12 text-center text-xs text-neutral-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-violet-500 mb-2" />
                      Loading logs...
                    </div>
                  ) : webhookLogs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-600 border border-neutral-900 rounded-2xl bg-neutral-900/10">
                      No webhook logs found for your account.
                    </div>
                  ) : (
                    webhookLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-neutral-900 bg-neutral-900/30 p-4 flex justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                log.isSuccess ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-red-500 shadow-sm shadow-red-500'
                              }`}
                            />
                            <span className="font-bold text-white">Event: {log.event}</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 font-mono truncate select-all">{log.url}</p>
                          <p className="text-[9px] text-neutral-600">{new Date(log.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                              log.isSuccess ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {log.statusCode || 'Timeout'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLogDetail(log)}
                            className="h-8 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white text-xs px-2"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Downloads, Links, Recent Activity */}
          <div className="space-y-6">
            
            {/* APK Download & Demo */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">Listener Application</h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                Download the companion Android APK and install it on your Android device to start auto-detecting and confirming customer payments.
              </p>
              
              <div className="space-y-2">
                <Button
                  asChild
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-semibold"
                >
                  <a href="/apks/InstaPay-Detector.apk" download>
                    <Download className="mr-1.5 h-4 w-4" />
                    Download Detector APK
                  </a>
                </Button>
                
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded-xl h-10 font-semibold"
                >
                  <a href={`/pay/${client.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Open Checkout Demo
                  </a>
                </Button>
              </div>
            </div>

            {/* Recent Merchant Activity */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 overflow-hidden">
              <div className="border-b border-neutral-900 px-4 py-3 bg-neutral-950/40 animate-pulse">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Recent Merchant Activity</span>
              </div>
              
              <ScrollArea className="h-[380px]">
                <div className="p-3 space-y-2">
                  {recentTx.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-600">No confirmed payments yet.</div>
                  ) : (
                    recentTx.map((tx) => (
                      <div
                        key={tx.sessionId}
                        className="rounded-xl bg-neutral-950/50 p-3 border border-neutral-900 flex justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-white block truncate">{tx.senderHandle}</span>
                          <span className="text-[10px] text-neutral-500 block mt-1 font-mono">{tx.detectedRef || tx.sessionId.slice(0, 12)}</span>
                          <span className="text-[9px] text-neutral-600 block mt-0.5">{tx.detectedAtEgypt}</span>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <span className="font-black text-emerald-400">+{formatEgp(tx.amountEgp)} EGP</span>
                          <span className="block text-[9px] text-neutral-500 mt-1 uppercase font-semibold">{tx.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </main>

      {/* Webhook Log Detail Modal */}
      <AnimatePresence>
        {selectedLogDetail && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLogDetail(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col space-y-4 rounded-3xl border border-neutral-800 bg-neutral-950 p-4 text-neutral-200 shadow-2xl sm:max-h-[90vh] sm:p-6"
            >
              <div>
                <h3 className="text-lg font-bold text-white">Webhook Attempt Detail</h3>
                <p className="text-xs text-neutral-500 mt-1">Delivery details for event: {selectedLogDetail.event}</p>
              </div>

              <ScrollArea className="flex-1 pr-1 space-y-4">
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-850 bg-neutral-900/40 p-3 sm:grid-cols-2">
                    <div>
                      <span className="text-neutral-500 font-semibold block">Status</span>
                      <span className={`block font-bold mt-0.5 ${selectedLogDetail.isSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
                        {selectedLogDetail.isSuccess ? 'SUCCESS' : 'FAILED'} (HTTP {selectedLogDetail.statusCode || 'N/A'})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-neutral-500 font-semibold block">Destination URL</span>
                    <p className="font-mono bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850 text-neutral-300 break-all select-all">
                      {selectedLogDetail.url}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-neutral-500 font-semibold block">Payload Sent (JSON)</span>
                    <pre className="font-mono bg-neutral-900/60 p-3 rounded-lg border border-neutral-850 text-[10px] text-neutral-300 overflow-x-auto select-all max-h-48">
                      {safeJsonFormat(selectedLogDetail.payload)}
                    </pre>
                  </div>

                  <div className="space-y-1 font-mono">
                    <span className="text-neutral-500 font-sans font-semibold block">Server Response Snippet</span>
                    <pre className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-850 text-[10px] text-neutral-300 overflow-x-auto max-h-48 break-all whitespace-pre-wrap select-all">
                      {selectedLogDetail.response || 'No response returned.'}
                    </pre>
                  </div>
                </div>
              </ScrollArea>

              <div className="flex justify-end pt-2 border-t border-neutral-850">
                <Button
                  onClick={() => setSelectedLogDetail(null)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs px-4"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-900 py-6 bg-neutral-950 text-center text-xs text-neutral-600">
        InstaPay Gateway · Merchant Dashboard
      </footer>
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
  unit?: string
  sub: string
  tone: 'violet' | 'emerald' | 'amber'
}) {
  const tones = {
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', ring: 'border-violet-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'border-amber-500/20' },
  }[tone]

  return (
    <div className={`rounded-2xl border ${tones.ring} bg-neutral-900/30 p-5 shadow-sm`}>
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones.bg} ${tones.text} border ${tones.ring}`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold text-white tracking-tight">{value}</span>
        {unit && <span className="text-xs font-semibold text-neutral-400">{unit}</span>}
      </div>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
    </div>
  )
}
