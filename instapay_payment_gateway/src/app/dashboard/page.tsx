'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BookOpen,
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
  CreditCard,
  Zap,
  Play,
  Send,
  Radio,
  Layers,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MerchantSidebar, DashboardTab } from '@/components/merchant-sidebar'
import { MerchantHeader } from '@/components/merchant-header'

interface ClientSession {
  id: string
  slug: string
  businessName: string
  businessType: string | null
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
  detectedAt: string | null
  detectedAtEgypt: string | null
  createdAt: string
  createdAtEgypt: string
}

interface TransactionLog {
  id?: string
  sessionId: string
  senderHandle: string
  recipientHandle: string
  amountEgp: number
  currency: string
  status: string
  detectedRef: string | null
  detectedAt: string | null
  detectedAtEgypt?: string | null
  createdAt: string
  createdAtEgypt?: string | null
  note?: string | null
}

interface WebhookLog {
  id: string
  url: string
  event: string
  payload: string
  statusCode: number | null
  response: string | null
  isSuccess: boolean
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

interface ProcessMonitorData {
  detector: {
    isActive: boolean
    lastSeenAt: string | null
    lastSeenMinsAgo: number | null
    configuredHandle: string
    tokenConfigured: boolean
  }
  matcher: {
    pendingSessions: number
    confirmedTotal: number
    expiredTotal: number
    avgConfirmationSpeedSec: number
    matchRatePercent: number
  }
  webhookWorker: {
    endpointUrl: string | null
    secretConfigured: boolean
    totalDispatched: number
    successfulDispatched: number
    failedDispatched: number
    pendingRetriesCount: number
    successRatePercent: number
  }
  apiGateway: {
    keyLastUsedAt: string | null
    plan: string
    quotaUsed: number
    quotaLimit: number
    checkoutTtlMin: number
  }
  pipelineEvents: Array<{
    id: string
    type: string
    title: string
    description: string
    timestamp: string
    timestampEgypt: string
    status: 'success' | 'warning' | 'pending' | 'error'
    meta?: Record<string, any>
  }>
}

interface MerchantNotification {
  id: string
  title: string
  message: string
  severity: string
  createdAt: string
  readAt?: string | null
}

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

  // Sidebar & Layout state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  // Dashboard state
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTx, setRecentTx] = useState<RecentTx[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [snippets, setSnippets] = useState<Snippets | null>(null)
  const [selectedSnippetTab, setSelectedSnippetTab] = useState<keyof Snippets>('curl')
  const [notifications, setNotifications] = useState<MerchantNotification[]>([])
  const [dashboardTimezone, setDashboardTimezone] = useState<{
    timeZone: string
    dstMode: 'AUTO' | 'SUMMER' | 'WINTER'
    dstActive: boolean
    currentEgyptTime: string
  } | null>(null)

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    )
    try {
      await fetch('/api/merchant/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {}
  }

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.readAt)
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
    )
    for (const item of unread) {
      try {
        await fetch('/api/merchant/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        })
      } catch {}
    }
  }

  // Integration settings form state
  const [businessNameInput, setBusinessNameInput] = useState('')
  const [businessTypeInput, setBusinessTypeInput] = useState('')
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('monitor')
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

  // Process Monitor State
  const [monitorData, setMonitorData] = useState<ProcessMonitorData | null>(null)
  const [monitorLoading, setMonitorLoading] = useState(false)

  // Webhook Simulator State
  const [simUrl, setSimUrl] = useState('')
  const [simEvent, setSimEvent] = useState('payment.confirmed')
  const [simAmount, setSimAmount] = useState('150.00')
  const [simSender, setSimSender] = useState('customer@instapay')
  const [simNote, setSimNote] = useState('Test Order #999')
  const [simLoading, setSimLoading] = useState(false)
  const [simResult, setSimResult] = useState<any | null>(null)
  const [simError, setSimError] = useState<string | null>(null)

  // Quick Checkout Generator State
  const [quickAmount, setQuickAmount] = useState('50.00')
  const [quickSender, setQuickSender] = useState('customer@instapay')
  const [quickNote, setQuickNote] = useState('Demo Checkout Test')
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickResult, setQuickResult] = useState<any | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [quickPollingStatus, setQuickPollingStatus] = useState<string | null>(null)

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('instapay_sidebar_collapsed')
      if (stored === 'true') setIsSidebarCollapsed(true)
    }
  }, [])

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('instapay_sidebar_collapsed', String(next))
      }
      return next
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
        if (data.timezoneInfo) setDashboardTimezone(data.timezoneInfo)
      }
      try {
        const notifRes = await fetch('/api/merchant/notifications', { cache: 'no-store' })
        const notifData = await notifRes.json()
        if (notifData.ok && Array.isArray(notifData.notifications)) {
          setNotifications(notifData.notifications)
        }
      } catch {}
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
          businessName: businessNameInput || null,
          businessType: businessTypeInput || null,
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
          setBusinessNameInput(data.client.businessName || '')
          setBusinessTypeInput(data.client.businessType || '')
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

  const loadProcessMonitor = async () => {
    if (!client) return
    setMonitorLoading(true)
    try {
      const headers = { Authorization: `Bearer ${client.apiKey}` }
      const res = await fetch('/api/dashboard/processes', { headers })
      const data = await res.json()
      if (data.ok) {
        setMonitorData(data.monitor)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setMonitorLoading(false)
    }
  }

  const handleRunWebhookSimulation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) return
    setSimLoading(true)
    setSimError(null)
    setSimResult(null)
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${client.apiKey}`,
      }
      const res = await fetch('/api/dashboard/webhook-test', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetUrl: simUrl || client.webhookUrl,
          event: simEvent,
          amountEgp: parseFloat(simAmount) || 150,
          senderHandle: simSender,
          note: simNote,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setSimResult(data.testResult)
      } else {
        setSimError(data.error || 'Webhook simulation failed.')
      }
    } catch {
      setSimError('Connection failed.')
    } finally {
      setSimLoading(false)
    }
  }

  const handleCreateQuickCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) return
    setQuickLoading(true)
    setQuickError(null)
    setQuickResult(null)
    setQuickPollingStatus('PENDING')
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${client.apiKey}`,
      }
      const res = await fetch('/api/v1/checkout/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amountEgp: parseFloat(quickAmount) || 50,
          senderHandle: quickSender,
          note: quickNote,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setQuickResult(data.checkout)
      } else {
        setQuickError(data.error || 'Failed to create test checkout.')
      }
    } catch {
      setQuickError('Connection failed.')
    } finally {
      setQuickLoading(false)
    }
  }

  useEffect(() => {
    if (!quickResult || quickPollingStatus !== 'PENDING') return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/checkout/status?sessionId=${quickResult.sessionId}`)
        const data = await res.json()
        if (data.ok && data.transaction) {
          setQuickPollingStatus(data.transaction.status)
        }
      } catch (err) {
        console.error(err)
      }
    }, 3000)
    return () => clearInterval(id)
  }, [quickResult?.sessionId, quickPollingStatus])

  useEffect(() => {
    if (client) {
      if (activeTab === 'monitor') {
        loadProcessMonitor()
        const id = setInterval(() => loadProcessMonitor(), 8000)
        return () => clearInterval(id)
      } else if (activeTab === 'transactions') {
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
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* Collapsible Sidebar */}
      <MerchantSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        client={client}
        pendingTxCount={stats?.pending?.count || 0}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLogout={handleLogout}
        onCopyDetectToken={() => {
          if (client.detectToken) copyToClipboard(client.detectToken, 'APK Token')
        }}
        copiedToken={copiedLabel === 'APK Token'}
      />

      {/* Main Content Viewport */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ps-20' : 'lg:ps-64'}`}>
        <MerchantHeader
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          egyptTime={dashboardTimezone?.currentEgyptTime || null}
          dstActive={dashboardTimezone?.dstActive}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onQuickSimulate={() => setActiveTab('tools')}
          isCollapsed={isSidebarCollapsed}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6">
          {/* Inline Unread Announcement / Notification Banner (Non-intrusive) */}
          {notifications.filter((n) => !n.readAt).slice(0, 1).map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-3 rounded-2xl border p-4 shadow-lg transition ${
                n.severity === 'URGENT'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  : n.severity === 'WARNING'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : n.severity === 'SUCCESS'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-violet-500/30 bg-violet-600/10 text-violet-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base">
                  {n.severity === 'URGENT' ? '🚨' : n.severity === 'WARNING' ? '⚠️' : n.severity === 'SUCCESS' ? '✅' : '📢'}
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{n.title}</span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.2 text-[9px] font-extrabold uppercase">
                      {n.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-5">{n.message}</p>
                </div>
              </div>
              <button
                onClick={() => handleMarkNotificationRead(n.id)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        {/* Main Workspace: Active Tab Content */}
        <div ref={integrationSectionRef} tabIndex={-1} className="space-y-6 outline-none">

            {/* Tab: Process Monitor */}
            {activeTab === 'monitor' && (
              <div className="space-y-6">
                {/* 4 Stat Cards */}
                {stats && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                      sub={`${stats.pending.count} awaiting confirmation`}
                      tone="amber"
                    />
                    <StatCard
                      icon={<CreditCard className="h-5 w-5" />}
                      label="Plan Quota"
                      value={`${usagePercent}%`}
                      unit={`${client.txCount}/${client.txLimit}`}
                      sub={client.isFreeTrial ? 'Free trial tier' : subscriptionLabel}
                      tone="violet"
                    />
                  </div>
                )}

                {/* Gateway Setup Reminder (Only if incomplete) */}
                {!setupComplete && (
                  <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-amber-400" />
                        <h3 className="text-sm font-bold text-white">Complete your gateway setup</h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        {completedSetupItems} of {setupItems.length} steps complete. Configure your receiving handle and webhook to start processing production payments.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={openIntegrationSetup}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 shrink-0 font-semibold"
                    >
                      Open Setup
                    </Button>
                  </div>
                )}

                {/* Header & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-neutral-900 bg-gradient-to-r from-violet-950/20 via-neutral-900/30 to-indigo-950/20 p-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Radio className="h-5 w-5 text-emerald-400 animate-pulse" />
                      <h2 className="text-base font-bold text-white">Live Process & Service Monitor</h2>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Real-time status of your detection pipeline, listener APK, matching engine, and webhook dispatcher.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 font-mono">Auto-refreshes every 8s</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadProcessMonitor}
                      disabled={monitorLoading}
                      className="h-8 rounded-xl border-neutral-800 text-neutral-300 hover:text-white bg-neutral-950 text-xs px-3"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${monitorLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* 4 Process Health Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Detector APK Card */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Listener APK Service</h3>
                          <p className="text-[10px] text-neutral-500">Android companion app</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        monitorData?.detector.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${monitorData?.detector.isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {monitorData?.detector.isActive ? 'Active' : 'Standby / Idle'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-900/80 text-[11px]">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Monitored Handle</span>
                        <span className="font-mono text-neutral-300 font-semibold truncate block">{client.instapayHandle}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Last Activity</span>
                        <span className="text-neutral-300">
                          {monitorData?.detector.lastSeenMinsAgo !== null && monitorData?.detector.lastSeenMinsAgo !== undefined
                            ? (monitorData.detector.lastSeenMinsAgo === 0 ? 'Just now' : `${monitorData.detector.lastSeenMinsAgo}m ago`)
                            : 'Awaiting first event'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Matcher Engine Card */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Zap className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Matcher Engine</h3>
                          <p className="text-[10px] text-neutral-500">Auto-confirmation worker</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Operational
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-900/80 text-[11px]">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Pending</span>
                        <span className="font-mono text-amber-400 font-bold">{monitorData?.matcher.pendingSessions ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Avg Latency</span>
                        <span className="font-mono text-neutral-300 font-bold">{monitorData?.matcher.avgConfirmationSpeedSec ?? 0}s</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Match Rate</span>
                        <span className="font-mono text-emerald-400 font-bold">{monitorData?.matcher.matchRatePercent ?? 100}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Webhook Worker Card */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Globe className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Webhook Dispatcher</h3>
                          <p className="text-[10px] text-neutral-500">Store notification relay</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        client.webhookUrl
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${client.webhookUrl ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
                        {client.webhookUrl ? 'Configured' : 'Not Set'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-900/80 text-[11px]">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Delivered</span>
                        <span className="font-mono text-neutral-300 font-bold">{monitorData?.webhookWorker.successfulDispatched ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Failed</span>
                        <span className="font-mono text-red-400 font-bold">{monitorData?.webhookWorker.failedDispatched ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Success Rate</span>
                        <span className="font-mono text-emerald-400 font-bold">{monitorData?.webhookWorker.successRatePercent ?? 100}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Gateway Plan & Quota Card */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Gateway Quota & TTL</h3>
                          <p className="text-[10px] text-neutral-500">Plan & session limits</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                        {client.subscriptionPlan.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-900/80 text-[11px]">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Transactions Used</span>
                        <span className="font-mono text-neutral-300 font-bold">{client.txCount} / {client.txLimit}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Checkout TTL</span>
                        <span className="font-mono text-neutral-300 font-bold">{client.checkoutTtlMin} mins</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Process Pipeline Visualizer */}
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-violet-400" />
                      <h3 className="text-sm font-bold text-white">End-to-End Pipeline Stages</h3>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">Live processing flow</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-3 rounded-xl border border-neutral-900 bg-neutral-950/80 space-y-1">
                      <div className="text-[10px] font-bold text-violet-400 uppercase">1. Checkout</div>
                      <div className="text-[11px] font-semibold text-white">Store Creates API</div>
                      <div className="text-[10px] text-neutral-500">POST /v1/checkout</div>
                    </div>

                    <div className="p-3 rounded-xl border border-neutral-900 bg-neutral-950/80 space-y-1">
                      <div className="text-[10px] font-bold text-indigo-400 uppercase">2. Customer</div>
                      <div className="text-[11px] font-semibold text-white">Sends InstaPay</div>
                      <div className="text-[10px] text-neutral-500">via App / IPN Link</div>
                    </div>

                    <div className="p-3 rounded-xl border border-neutral-900 bg-neutral-950/80 space-y-1">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase">3. Detector</div>
                      <div className="text-[11px] font-semibold text-white">Intercepts Push</div>
                      <div className="text-[10px] text-neutral-500">Extracts EGP & Sender</div>
                    </div>

                    <div className="p-3 rounded-xl border border-neutral-900 bg-neutral-950/80 space-y-1">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase">4. Matcher</div>
                      <div className="text-[11px] font-semibold text-white">Matches Session</div>
                      <div className="text-[10px] text-neutral-500">Sets CONFIRMED</div>
                    </div>

                    <div className="p-3 rounded-xl border border-neutral-900 bg-neutral-950/80 space-y-1">
                      <div className="text-[10px] font-bold text-pink-400 uppercase">5. Webhook</div>
                      <div className="text-[11px] font-semibold text-white">Store Fulfillment</div>
                      <div className="text-[10px] text-neutral-500">Signed HMAC POST</div>
                    </div>
                  </div>
                </div>

                {/* Unified Live Events Feed */}
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white">Live Event Stream & Activity Feed</h3>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">Egypt Timezone (UTC+2 / UTC+3)</span>
                  </div>

                  {monitorLoading && !monitorData ? (
                    <div className="py-12 text-center text-xs text-neutral-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-violet-500 mb-2" />
                      Loading process telemetry...
                    </div>
                  ) : !monitorData?.pipelineEvents || monitorData.pipelineEvents.length === 0 ? (
                    <div className="py-10 text-center text-xs text-neutral-600 border border-neutral-900 rounded-xl bg-neutral-900/10">
                      No recent activity recorded yet. Create a checkout or test webhook to start telemetry.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {monitorData.pipelineEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="rounded-xl border border-neutral-900 bg-neutral-950/70 p-3 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${
                                evt.status === 'success' ? 'bg-emerald-500 shadow-sm shadow-emerald-500' :
                                evt.status === 'warning' ? 'bg-amber-500 shadow-sm shadow-amber-500' :
                                evt.status === 'error' ? 'bg-red-500 shadow-sm shadow-red-500' :
                                'bg-violet-500 shadow-sm shadow-violet-500'
                              }`} />
                              <span className="font-bold text-white truncate">{evt.title}</span>
                              <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded uppercase ${
                                evt.type === 'payment_confirmed' ? 'bg-emerald-500/15 text-emerald-400' :
                                evt.type === 'checkout_created' ? 'bg-violet-500/15 text-violet-300' :
                                evt.type === 'webhook_dispatched' ? 'bg-cyan-500/15 text-cyan-300' :
                                'bg-amber-500/15 text-amber-300'
                              }`}>
                                {evt.type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 pl-4">{evt.description}</p>
                          </div>
                          <div className="text-right shrink-0 text-[10px] text-neutral-500 font-mono">
                            {evt.timestampEgypt || new Date(evt.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Support Workspace: Downloads, Links, Recent Activity */}
                <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
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
                    <div className="border-b border-neutral-900 px-4 py-3 bg-neutral-950/40">
                      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Recent Merchant Activity</span>
                    </div>
                    
                    <ScrollArea className="h-[280px]">
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
            )}

            {/* Tab: Simulation & Developer Tools */}
            {activeTab === 'tools' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="rounded-2xl border border-neutral-900 bg-gradient-to-r from-indigo-950/20 via-neutral-900/30 to-violet-950/20 p-5 space-y-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-violet-400" />
                    <h2 className="text-base font-bold text-white">Developer Simulation & Testing Sandbox</h2>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Test your webhook handler with live HMAC-SHA256 signatures, create on-demand checkout sessions, and verify integrations without sending real money.
                  </p>
                </div>

                {/* Tool 1: Interactive Webhook Simulator */}
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-cyan-400" />
                      <h3 className="text-sm font-bold text-white">Interactive Webhook Simulator</h3>
                    </div>
                    <span className="text-[10px] text-cyan-400/90 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">HMAC-SHA256 Signed</span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Dispatches a real HTTP POST request to your store endpoint signed with your webhook secret. Test your verification logic, error handling, and response timing.
                  </p>

                  <form onSubmit={handleRunWebhookSimulation} className="space-y-4 bg-neutral-950 p-4 rounded-xl border border-neutral-900">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Destination Webhook URL</Label>
                        <Input
                          value={simUrl || (client.webhookUrl || '')}
                          onChange={(e) => setSimUrl(e.target.value)}
                          placeholder="https://yourstore.com/api/webhooks/instapay"
                          className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Event Type</Label>
                        <select
                          value={simEvent}
                          onChange={(e) => setSimEvent(e.target.value)}
                          className="w-full h-9 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-xs text-neutral-200 focus:outline-none"
                        >
                          <option value="payment.confirmed">payment.confirmed (Full Success)</option>
                          <option value="payment.underpaid">payment.underpaid (Partial Payment)</option>
                          <option value="payment.expired">payment.expired (Session Timeout)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Amount (EGP)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={simAmount}
                          onChange={(e) => setSimAmount(e.target.value)}
                          className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Customer Sender Handle</Label>
                        <Input
                          value={simSender}
                          onChange={(e) => setSimSender(e.target.value)}
                          className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Order Reference / Note</Label>
                        <Input
                          value={simNote}
                          onChange={(e) => setSimNote(e.target.value)}
                          className="bg-neutral-900 border-neutral-800 text-xs"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={simLoading}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {simLoading ? 'Dispatching Test Webhook…' : 'Send Signed Test Webhook'}
                    </Button>
                  </form>

                  {simError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                      {simError}
                    </div>
                  )}

                  {simResult && (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            simResult.isSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            HTTP {simResult.statusCode || 'Failed'}
                          </span>
                          <span className="text-white font-semibold">{simResult.isSuccess ? 'Delivery Successful' : 'Endpoint Returned Error'}</span>
                        </div>
                        <span className="text-neutral-400 font-mono text-[11px]">Roundtrip: {simResult.roundtripLatencyMs}ms</span>
                      </div>

                      <div className="space-y-2 text-[11px]">
                        <div>
                          <span className="text-neutral-500 block">Server Response Body:</span>
                          <pre className="mt-1 p-2 rounded bg-neutral-900/80 font-mono text-neutral-300 overflow-x-auto text-[10px]">{simResult.responseBody}</pre>
                        </div>

                        <div>
                          <span className="text-neutral-500 block">Sent Headers (Includes HMAC Signature):</span>
                          <pre className="mt-1 p-2 rounded bg-neutral-900/80 font-mono text-cyan-300 overflow-x-auto text-[10px]">{JSON.stringify(simResult.sentHeaders, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tool 2: Quick Checkout Generator Sandbox */}
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Play className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Quick Checkout Generator Sandbox</h3>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Instantly create a test checkout session and interact with the live QR code, deep link, and automatic status polling.
                  </p>

                  <form onSubmit={handleCreateQuickCheckout} className="space-y-4 bg-neutral-950 p-4 rounded-xl border border-neutral-900">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Amount (EGP)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={quickAmount}
                          onChange={(e) => setQuickAmount(e.target.value)}
                          className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Expected Sender Handle</Label>
                        <Input
                          value={quickSender}
                          onChange={(e) => setQuickSender(e.target.value)}
                          className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-neutral-300 text-[11px]">Order Note</Label>
                        <Input
                          value={quickNote}
                          onChange={(e) => setQuickNote(e.target.value)}
                          className="bg-neutral-900 border-neutral-800 text-xs"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={quickLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                    >
                      <Zap className="mr-1.5 h-3.5 w-3.5" />
                      {quickLoading ? 'Generating Session…' : 'Create Live Test Checkout'}
                    </Button>
                  </form>

                  {quickError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                      {quickError}
                    </div>
                  )}

                  {quickResult && (
                    <div className="rounded-xl border border-emerald-500/20 bg-neutral-950 p-5 space-y-4 text-xs">
                      <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-white text-sm">Session: {quickResult.sessionId}</span>
                          <p className="text-[11px] text-neutral-400">Total: {quickResult.amountEgp} EGP • Recipient: {quickResult.recipientHandle}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                          quickPollingStatus === 'CONFIRMED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                        }`}>
                          {quickPollingStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div className="flex items-center justify-center rounded-2xl border border-slate-800/80 bg-[#070a12] p-4 shadow-inner">
                          <div className="rounded-xl bg-white p-2.5 shadow-lg shadow-black/40">
                            <img src={quickResult.qrCodeDataUrl} alt="QR Code" className="h-40 w-40 object-contain" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <a
                            href={quickResult.deepLinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <Button className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold">
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Open InstaPay Deep Link
                            </Button>
                          </a>
                          <Link href={`/pay/${client.slug}?amount=${quickResult.amountEgp}&sender=${quickResult.senderHandle}`} target="_blank">
                            <Button variant="outline" className="w-full border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs">
                              Open Customer Payment Portal
                            </Button>
                          </Link>
                          <p className="text-[10px] text-neutral-500 text-center">
                            Session will auto-update status when detector reports the transfer.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
	                    <div className="rounded-2xl border border-neutral-900 bg-neutral-950/60 p-4">
	                      <div className="mb-4 flex items-center justify-between gap-3">
	                        <div>
	                          <h3 className="text-sm font-bold text-white">Business profile</h3>
	                          <p className="mt-1 text-[10px] leading-5 text-neutral-500">
	                            Keep your public merchant identity accurate for reviews, support, billing, and future checkout pages.
	                          </p>
	                        </div>
	                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-neutral-400">
	                          Editable
	                        </span>
	                      </div>
	                      <div className="grid gap-4 md:grid-cols-2">
	                        <div className="space-y-1.5">
	                          <Label htmlFor="businessName" className="text-xs text-neutral-400">
	                            Business Name
	                          </Label>
	                          <Input
	                            id="businessName"
	                            type="text"
	                            placeholder="Example Store"
	                            value={businessNameInput}
	                            onChange={(e) => setBusinessNameInput(e.target.value)}
	                            className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
	                            maxLength={120}
	                          />
	                        </div>
	                        <div className="space-y-1.5">
	                          <Label htmlFor="businessType" className="text-xs text-neutral-400">
	                            Business Type
	                          </Label>
	                          <select
	                            id="businessType"
	                            value={businessTypeInput}
	                            onChange={(e) => setBusinessTypeInput(e.target.value)}
	                            className="h-10 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/35"
	                          >
	                            <option value="">Select business type</option>
	                            <option value="E-commerce">E-commerce</option>
	                            <option value="Retail store">Retail store</option>
	                            <option value="Digital services">Digital services</option>
	                            <option value="Food and beverage">Food and beverage</option>
	                            <option value="Education">Education</option>
	                            <option value="Healthcare">Healthcare</option>
	                            <option value="Freelancer">Freelancer</option>
	                            <option value="Nonprofit">Nonprofit</option>
	                            <option value="Other">Other</option>
	                          </select>
	                        </div>
	                      </div>
	                    </div>

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

                {/* Full Integration Guide Link */}
                <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/20 to-indigo-950/20 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-violet-400" />
                        <h3 className="text-sm font-bold text-white">Full Integration Guide</h3>
                      </div>
                      <p className="text-xs text-neutral-400">Step-by-step guide with your live credentials, payment flow diagrams, webhook verification examples, and code samples in Node.js, Python, and PHP.</p>
                    </div>
                    <Link href="/dashboard/guide">
                      <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold px-6 whitespace-nowrap">
                        <BookOpen className="mr-1.5 h-4 w-4" />
                        Open Guide
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Plans & Billing */}
            {activeTab === 'billing' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Active Plan & Quota Card */}
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/40 p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                        Current Plan: <span className="text-violet-400 font-extrabold">{subscriptionLabel}</span>
                      </h3>
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

                    {/* Progress Bar */}
                    <div className="pt-2 w-full max-w-lg">
                      <div className="flex items-center justify-between text-xs pb-1.5 font-medium">
                        <span className="text-neutral-400">Monthly Quota Consumption</span>
                        <span className="font-mono text-white font-bold">
                          {client.txCount.toLocaleString()} / {client.txLimit.toLocaleString()} ({usagePercent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
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
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end justify-center rounded-xl bg-neutral-950/80 border border-neutral-850 p-4 shrink-0">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Status</span>
                    <span className={`text-xs font-black uppercase mt-1 ${quotaState === 'limit-reached' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {quotaState === 'limit-reached' ? 'Quota Exceeded' : 'Active & Processing'}
                    </span>
                    <span className="text-[11px] text-neutral-400 mt-1">
                      {client.subscriptionPlan === 'BASIC' ? '200 EGP/mo' : client.subscriptionPlan === 'PRO' ? '500 EGP/mo' : client.subscriptionPlan === 'ENTERPRISE' ? '700 EGP/mo' : 'Free Trial'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-violet-400" />
                    <h2 className="text-base font-bold text-white">Available Upgrade Plans</h2>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Select a plan and scan the QR code to subscribe or renew your transaction limit.
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
                    <div className="mx-auto flex w-full max-w-[180px] items-center justify-center rounded-2xl border border-slate-800/80 bg-[#070a12] p-3 shadow-inner md:max-w-none">
                      <div className="rounded-xl bg-white p-2 shadow-lg shadow-black/40">
                        <img src={subscriptionCheckout.qrCodeDataUrl} alt="Subscription payment QR" className="w-full max-w-[140px] h-auto object-contain" />
                      </div>
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

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <Button
                  onClick={() => setSelectedLogDetail(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs px-4"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0e1628] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-bold text-white">Merchant Account & Gateway Settings</h3>
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-300">Business Name</Label>
                  <Input
                    value={businessNameInput}
                    onChange={(e) => setBusinessNameInput(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">InstaPay Handle</Label>
                  <Input
                    value={instapayHandleInput}
                    onChange={(e) => setInstapayHandleInput(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Webhook URL</Label>
                  <Input
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Checkout TTL (Minutes)</Label>
                  <Input
                    type="number"
                    value={checkoutTtlInput}
                    onChange={(e) => setCheckoutTtlInput(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                {settingsError && (
                  <p className="text-xs text-rose-400">{settingsError}</p>
                )}
                {settingsSuccess && (
                  <p className="text-xs text-emerald-400">Settings saved successfully.</p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updatingSettings}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold"
                  >
                    {updatingSettings ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-6 bg-[#070a12] text-center text-xs text-slate-400">
        InstaPay Gateway · Merchant Operations Console
      </footer>
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
