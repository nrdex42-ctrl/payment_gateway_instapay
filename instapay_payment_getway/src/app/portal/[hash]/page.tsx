'use client'

import { useEffect, useState, use } from 'react'
import { notFound } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  CheckCircle,
  XCircle,
  Copy,
  Trash2,
  ExternalLink,
  ChevronRight,
  Key,
  Globe,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  Smartphone,
  Download,
  Search,
  Filter,
  Eye,
  EyeOff,
  Calendar,
  Bell,
  Gauge,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ClientStats {
  id: string
  slug: string
  businessName: string
  instapayHandle: string
  email: string
  apiKey: string | null
  detectToken: string | null
  webhookUrl: string | null
  isActive: boolean
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  checkoutTtlMin: number
  createdAt: string
  totalTransactions: number
  confirmedVolume: number
  subscriptionPlan: string
  isFreeTrial: boolean
  subscriptionEndsAt: string | null
  txLimit: number
  txCount: number
}

interface PlatformStats {
  totalClients: number
  activeClients: number
  today: { count: number; totalEgp: number }
  sevenDays: { count: number; totalEgp: number }
  pending: { count: number; totalEgp: number }
}

interface RecentTx {
  sessionId: string
  businessName: string
  senderHandle: string
  recipientHandle: string
  amountEgp: number
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
  businessName: string
  url: string
  isSuccess: boolean
  statusCode: number | null
  payload: string
  response: string | null
  createdAt: string
}

interface AuditLog {
  id: string
  action: string
  details: string
  createdAt: string
}

interface Plan {
  id: string
  name: string
  priceEgp: number
  maxTransactions: number
}

type AdminTab = 'ops' | 'merchants' | 'billing' | 'notifications' | 'transactions' | 'webhooks' | 'activity' | 'settings' | 'audit'

const adminTabs: Array<{ id: AdminTab; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'ops', label: 'Ops Center', description: 'Risk, health, reliability, actions', icon: <Gauge className="h-4 w-4" /> },
  { id: 'merchants', label: 'Merchants', description: 'Approve, manage, suspend accounts', icon: <Users className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', description: 'Plan pricing and subscription health', icon: <Calendar className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', description: 'Message merchants on web and APK', icon: <Bell className="h-4 w-4" /> },
  { id: 'transactions', label: 'Transactions', description: 'Search, audit, force-confirm payments', icon: <Activity className="h-4 w-4" /> },
  { id: 'webhooks', label: 'Webhooks', description: 'Delivery success, failures, payloads', icon: <Globe className="h-4 w-4" /> },
  { id: 'activity', label: 'Activity', description: 'Recent platform payment stream', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', description: 'Timezone, DST, admin APK tools', icon: <Settings className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit', description: 'Administrative action history', icon: <Shield className="h-4 w-4" /> },
]

function formatEgp(value: number) {
  return new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
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

function usagePercent(count: number, limit: number) {
  return Math.min(100, (count / Math.max(limit, 1)) * 100)
}

function daysRemaining(value: string | null) {
  if (!value) return null
  return Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function AdminPortalPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params)
  const expectedHash = process.env.NEXT_PUBLIC_ADMIN_PORTAL_PATH

  // Security through obscurity verification
  if (hash !== expectedHash) {
    notFound()
  }

  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('owner_secret_token')
  )
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminTotp, setAdminTotp] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  // Platform data
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [clients, setClients] = useState<ClientStats[]>([])
  const [recentTx, setRecentTx] = useState<RecentTx[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [planDrafts, setPlanDrafts] = useState<Record<string, { priceEgp: string; maxTransactions: string }>>({})
  const [planSaving, setPlanSaving] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Client creation modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [instapayHandle, setInstapayHandle] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [checkoutTtlMin, setCheckoutTtlMin] = useState('10')
  const [modalError, setModalError] = useState<string | null>(null)
  const [savingClient, setSavingClient] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; businessName: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const [copiedText, setCopiedText] = useState<string | null>(null)

  const [dstMode, setDstMode] = useState<'AUTO' | 'SUMMER' | 'WINTER'>('AUTO')
  const [currentEgyptTime, setCurrentEgyptTime] = useState('')
  const [updatingSettings, setUpdatingSettings] = useState(false)

  // Advanced features states
  const [activeTab, setActiveTab] = useState<AdminTab>('ops')
  const [allTransactions, setAllTransactions] = useState<TransactionLog[]>([])
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [txFilters, setTxFilters] = useState({
    q: '',
    status: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    clientId: '',
  })

  const [webhookFilters, setWebhookFilters] = useState({
    success: '',
    clientId: '',
  })

  const [txLoading, setTxLoading] = useState(false)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [selectedLogDetail, setSelectedLogDetail] = useState<WebhookLog | null>(null)
  const [subscriptionUpdatingId, setSubscriptionUpdatingId] = useState<string | null>(null)
  const [notificationClientId, setNotificationClientId] = useState('')
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationSeverity, setNotificationSeverity] = useState('INFO')
  const [notificationSending, setNotificationSending] = useState(false)
  const [notificationResult, setNotificationResult] = useState<string | null>(null)
  const [merchantFilters, setMerchantFilters] = useState({
    q: '',
    status: 'ALL',
    setup: 'ALL',
    subscription: 'ALL',
    sort: 'RISK',
  })

  const sendMerchantNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotificationSending(true)
    setNotificationResult(null)
    try {
      const res = await fetch('/api/admin/notifications', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: notificationClientId, title: notificationTitle, message: notificationMessage, severity: notificationSeverity }) })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to send notification')
      setNotificationTitle(''); setNotificationMessage(''); setNotificationResult('Notification sent successfully.')
    } catch (error) { setNotificationResult(error instanceof Error ? error.message : 'Failed to send notification.') }
    finally { setNotificationSending(false) }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword, totp: adminTotp }),
      })
      const data = await res.json()
      if (data.ok) {
        localStorage.setItem('owner_secret_token', data.token)
        setToken(data.token)
      } else {
        setAuthError(data.error || 'Authentication failed.')
      }
    } catch {
      setAuthError('Connection error.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('owner_secret_token')
    setToken(null)
    setAdminEmail('')
    setAdminPassword('')
    setAdminTotp('')
  }

  const loadData = async () => {
    if (!token) return
    setRefreshing(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      
      const [statsRes, clientsRes, settingsRes, plansRes] = await Promise.all([
        fetch('/api/admin/dashboard', { headers }),
        fetch('/api/admin/clients', { headers }),
        fetch('/api/settings', { headers }),
        fetch('/api/admin/plans', { headers }),
      ])
      const [statsData, clientsData, settingsData, plansData] = await Promise.all([
        statsRes.json(),
        clientsRes.json(),
        settingsRes.json(),
        plansRes.json(),
      ])

      if (statsData.ok && clientsData.ok) {
        setPlatformStats(statsData.stats)
        setRecentTx(statsData.recent)
        setClients(clientsData.clients)
      } else {
        if (statsRes.status === 401 || clientsRes.status === 401) {
          handleLogout()
        }
      }

      if (settingsData && settingsData.ok) {
        setDstMode(settingsData.dstMode)
        setCurrentEgyptTime(settingsData.currentEgyptTime)
      }
      if (plansData && plansData.ok) {
        setPlans(plansData.plans)
        setPlanDrafts(Object.fromEntries(
          plansData.plans.map((plan: Plan) => [
            plan.name,
            { priceEgp: String(plan.priceEgp), maxTransactions: String(plan.maxTransactions) },
          ])
        ))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }

  const loadTransactions = async () => {
    if (!token) return
    setTxLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const params = new URLSearchParams()
      if (txFilters.q) params.set('q', txFilters.q)
      if (txFilters.status) params.set('status', txFilters.status)
      if (txFilters.minAmount) params.set('minAmount', txFilters.minAmount)
      if (txFilters.maxAmount) params.set('maxAmount', txFilters.maxAmount)
      if (txFilters.startDate) params.set('startDate', txFilters.startDate)
      if (txFilters.endDate) params.set('endDate', txFilters.endDate)
      if (txFilters.clientId) params.set('clientId', txFilters.clientId)

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
    if (!token) return
    setWebhookLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const params = new URLSearchParams()
      if (webhookFilters.success) params.set('success', webhookFilters.success)
      if (webhookFilters.clientId) params.set('clientId', webhookFilters.clientId)

      const res = await fetch(`/api/admin/webhooks?${params.toString()}`, { headers })
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

  const loadAuditLogs = async () => {
    if (!token) return
    setAuditLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch('/api/admin/audit', { headers })
      const data = await res.json()
      if (data.ok) {
        setAuditLogs(data.logs)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAuditLoading(false)
    }
  }

  const handleForceConfirm = async (sessionId: string) => {
    if (!confirm('Are you sure you want to manually force-confirm this payment? This will directly confirm the transaction and trigger webhook notifications.')) return
    try {
      const res = await fetch(`/api/admin/transactions/${sessionId}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.ok) {
        alert('Transaction manually confirmed.')
        loadData()
        loadTransactions()
      } else {
        alert(data.error || 'Failed to confirm transaction.')
      }
    } catch (err) {
      console.error(err)
      alert('Network error.')
    }
  }

  const handleExportCSV = () => {
    const params = new URLSearchParams()
    if (txFilters.q) params.set('q', txFilters.q)
    if (txFilters.status) params.set('status', txFilters.status)
    if (txFilters.minAmount) params.set('minAmount', txFilters.minAmount)
    if (txFilters.maxAmount) params.set('maxAmount', txFilters.maxAmount)
    if (txFilters.startDate) params.set('startDate', txFilters.startDate)
    if (txFilters.endDate) params.set('endDate', txFilters.endDate)
    if (txFilters.clientId) params.set('clientId', txFilters.clientId)

    fetch(`/api/transactions/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
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

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    setSavingClient(true)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessName,
          instapayHandle,
          email: emailInput,
          webhookUrl: webhookUrl || null,
          checkoutTtlMin: parseInt(checkoutTtlMin) || 10,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setShowAddModal(false)
        setCreatedCredentials({
          email: emailInput,
          password: data.client?.password || data.password || '(not returned)',
          businessName: businessName,
        })
        setBusinessName('')
        setInstapayHandle('')
        setEmailInput('')
        setWebhookUrl('')
        setCheckoutTtlMin('10')
        loadData()
      } else {
        setModalError(data.error || 'Failed to create client.')
      }
    } catch {
      setModalError('Connection error.')
    } finally {
      setSavingClient(false)
    }
  }

  const handleUpdateDstMode = async (newMode: 'AUTO' | 'SUMMER' | 'WINTER') => {
    setUpdatingSettings(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dstMode: newMode }),
      })
      const data = await res.json()
      if (data.ok) {
        setDstMode(data.dstMode)
        setCurrentEgyptTime(data.currentEgyptTime)
        loadData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingSettings(false)
    }
  }

  const handleApproveClient = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/clients/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRejectClient = async (id: string) => {
    if (!confirm('Are you sure you want to reject this registration?')) return
    try {
      const res = await fetch(`/api/admin/clients/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleClientStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      })
      if (res.ok) loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this merchant account?')) return
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateSubscription = async (
    id: string,
    plan: string,
    isTrial: boolean,
    addDays: number,
    mode: 'extend' | 'reset' = 'extend'
  ) => {
    setSubscriptionUpdatingId(id)
    try {
      const client = clients.find(c => c.id === id)
      if (!client) return
      
      let newDate: Date | null = null
      if (addDays > 0) {
         const baseDate =
           mode === 'extend' && client.subscriptionEndsAt && new Date(client.subscriptionEndsAt).getTime() > Date.now()
             ? new Date(client.subscriptionEndsAt)
             : new Date()
         newDate = new Date(baseDate.getTime() + addDays * 24 * 60 * 60 * 1000)
      } else if (addDays < 0) {
         newDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // expired yesterday
      } else {
         newDate = client.subscriptionEndsAt ? new Date(client.subscriptionEndsAt) : null
      }

      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          subscriptionPlan: plan,
          isFreeTrial: isTrial,
          subscriptionEndsAt: newDate?.toISOString() || null
        }),
      })
      if (res.ok) {
        loadData()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to update subscription.')
      }
    } catch (err) {
      console.error(err)
      alert('Network error while updating subscription.')
    } finally {
      setSubscriptionUpdatingId(null)
    }
  }

  const handleSwapMerchantPlan = async (merchant: ClientStats, nextPlanName: string) => {
    if (!nextPlanName || nextPlanName === merchant.subscriptionPlan) return

    const nextPlan = subscriptionPlanOptions.find((plan) => plan.name === nextPlanName)
    if (!nextPlan) {
      alert(`Plan '${nextPlanName}' was not found.`)
      return
    }

    const isTrial = nextPlan.name === 'FREE_TRIAL'
    const addDays = isTrial ? 1 : 30
    const confirmed = confirm(
      `Switch ${merchant.businessName} to ${nextPlan.name.replaceAll('_', ' ')}?\n\n` +
      `This will apply ${nextPlan.maxTransactions.toLocaleString()} monthly transactions and ${isTrial ? '1 trial day' : '30 paid-plan days'}.`
    )
    if (!confirmed) return

    await handleUpdateSubscription(merchant.id, nextPlan.name, isTrial, addDays, 'reset')
  }

  const handleUpdatePlan = async (planName: string) => {
    const draft = planDrafts[planName]
    if (!draft) return
    setPlanSaving(planName)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: planName,
          priceEgp: Number(draft.priceEgp),
          maxTransactions: Number(draft.maxTransactions),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        loadData()
      } else {
        alert(data.error || 'Failed to update plan.')
      }
    } catch (err) {
      console.error(err)
      alert('Network error while updating plan.')
    } finally {
      setPlanSaving(null)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  useEffect(() => {
    if (token) {
      loadData()
    }
  }, [token])

  useEffect(() => {
    if (token) {
      if (activeTab === 'transactions') {
        loadTransactions()
      } else if (activeTab === 'webhooks') {
        loadWebhookLogs()
      } else if (activeTab === 'audit') {
        loadAuditLogs()
      }
    }
  }, [activeTab, token])

  const pendingApprovals = clients.filter((c) => c.approvalStatus === 'PENDING')
  const activeMerchants = clients.filter((c) => c.approvalStatus === 'APPROVED')
  const disabledApprovedMerchants = activeMerchants.filter((c) => !c.isActive)
  const merchantsMissingWebhook = activeMerchants.filter((c) => !c.webhookUrl)
  const merchantsMissingDetector = activeMerchants.filter((c) => !c.detectToken || !c.apiKey)
  const expiredMerchants = activeMerchants.filter((c) => {
    const remaining = daysRemaining(c.subscriptionEndsAt)
    return remaining !== null && remaining <= 0
  })
  const nearExpiryMerchants = activeMerchants.filter((c) => {
    const remaining = daysRemaining(c.subscriptionEndsAt)
    return remaining !== null && remaining > 0 && remaining <= 3
  })
  const nearQuotaMerchants = activeMerchants.filter((c) => c.txLimit > 0 && c.txCount >= c.txLimit * 0.8)
  const quotaBlockedMerchants = activeMerchants.filter((c) => c.txLimit > 0 && c.txCount >= c.txLimit)
  const configuredMerchants = activeMerchants.filter((c) => Boolean(c.webhookUrl && c.apiKey && c.detectToken && c.isActive))
  const operationalIssues =
    pendingApprovals.length +
    disabledApprovedMerchants.length +
    merchantsMissingWebhook.length +
    merchantsMissingDetector.length +
    expiredMerchants.length +
    quotaBlockedMerchants.length
  const readinessPercent = activeMerchants.length > 0 ? Math.round((configuredMerchants.length / activeMerchants.length) * 100) : 100
  const healthScore = Math.max(0, Math.min(100, readinessPercent - Math.min(40, operationalIssues * 5)))
  const recentConfirmedCount = recentTx.filter((tx) => tx.status === 'CONFIRMED').length
  const recentPendingCount = recentTx.filter((tx) => tx.status === 'PENDING').length
  const subscriptionPlanOptions = plans.length > 0
    ? plans
    : [
        { id: 'fallback-free-trial', name: 'FREE_TRIAL', priceEgp: 0, maxTransactions: 5 },
        { id: 'fallback-basic', name: 'BASIC', priceEgp: 200, maxTransactions: 1000 },
        { id: 'fallback-pro', name: 'PRO', priceEgp: 500, maxTransactions: 3500 },
        { id: 'fallback-enterprise', name: 'ENTERPRISE', priceEgp: 700, maxTransactions: 10000 },
      ]
  const merchantRiskScore = (merchant: ClientStats) => {
    const remaining = daysRemaining(merchant.subscriptionEndsAt)
    let score = 0
    if (!merchant.isActive) score += 40
    if (remaining !== null && remaining <= 0) score += 40
    else if (remaining !== null && remaining <= 3) score += 18
    if (merchant.txLimit > 0 && merchant.txCount >= merchant.txLimit) score += 35
    else if (merchant.txLimit > 0 && merchant.txCount >= merchant.txLimit * 0.8) score += 18
    if (!merchant.webhookUrl) score += 15
    if (!merchant.apiKey) score += 15
    if (!merchant.detectToken) score += 15
    return score
  }
  const filteredMerchants = activeMerchants
    .filter((merchant) => {
      const query = merchantFilters.q.trim().toLowerCase()
      if (query) {
        const haystack = `${merchant.businessName} ${merchant.email} ${merchant.instapayHandle} ${merchant.slug}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }

      if (merchantFilters.status === 'ENABLED' && !merchant.isActive) return false
      if (merchantFilters.status === 'DISABLED' && merchant.isActive) return false

      const setupMissing = !merchant.webhookUrl || !merchant.apiKey || !merchant.detectToken
      if (merchantFilters.setup === 'READY' && setupMissing) return false
      if (merchantFilters.setup === 'MISSING' && !setupMissing) return false

      const remaining = daysRemaining(merchant.subscriptionEndsAt)
      const expired = remaining !== null && remaining <= 0
      const nearExpiry = remaining !== null && remaining > 0 && remaining <= 3
      const nearLimit = merchant.txLimit > 0 && merchant.txCount >= merchant.txLimit * 0.8
      const blocked = merchant.txLimit > 0 && merchant.txCount >= merchant.txLimit
      if (merchantFilters.subscription === 'EXPIRED' && !expired) return false
      if (merchantFilters.subscription === 'NEAR_EXPIRY' && !nearExpiry) return false
      if (merchantFilters.subscription === 'QUOTA_RISK' && !nearLimit) return false
      if (merchantFilters.subscription === 'BLOCKED' && !blocked) return false
      if (merchantFilters.subscription === 'TRIAL' && !merchant.isFreeTrial) return false
      if (merchantFilters.subscription === 'PAID' && (merchant.isFreeTrial || expired)) return false

      return true
    })
    .sort((a, b) => {
      if (merchantFilters.sort === 'REVENUE') return b.confirmedVolume - a.confirmedVolume
      if (merchantFilters.sort === 'TRANSACTIONS') return b.totalTransactions - a.totalTransactions
      if (merchantFilters.sort === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (merchantFilters.sort === 'NAME') return a.businessName.localeCompare(b.businessName)
      return merchantRiskScore(b) - merchantRiskScore(a)
    })

  // --- Render Login Page ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070a12] p-4 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg shadow-indigo-950/40">
              <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">InstaPay Gateway Admin</h1>
            <p className="text-sm text-neutral-400">
              Secure owner access for merchant approvals, transaction operations, billing, and platform observability.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Email Address
              </Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="instapay.payment.gateway@gmail.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="h-11 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus-visible:ring-violet-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="h-11 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus-visible:ring-violet-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-totp" className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                TOTP 2FA Code
              </Label>
              <Input
                id="admin-totp"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={adminTotp}
                onChange={(e) => setAdminTotp(e.target.value)}
                className="h-11 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus-visible:ring-violet-500 text-center font-mono tracking-widest text-lg"
                required
              />
            </div>

            {authError && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-400"
            >
              Sign in securely
            </Button>
          </form>
        </motion.div>
      </div>
    )
  }

  // --- Render Dashboard UI ---
  return (
    <div className="admin-portal min-h-screen bg-[#070a12] text-neutral-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg shadow-indigo-950/40">
              <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-white">InstaPay Gateway</h1>
                <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-400 border border-violet-500/30">
                  Platform Admin
                </span>
              </div>
              <p className="hidden text-xs text-neutral-500 sm:block">Owner operations console</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={refreshing}
              className="rounded-xl text-neutral-300 border-white/10 bg-white/[0.03] hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-xl text-neutral-500 hover:text-red-300 hover:bg-red-500/10"
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-5 sm:px-6 sm:py-6 space-y-5 sm:space-y-6">
        <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.28),transparent_34%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,6,23,.92))] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-6">
          <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-200">
                <Shield className="h-3.5 w-3.5" />
                Platform owner console
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                Operate merchants, payments, and delivery health from one control plane.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                Review merchant onboarding, monitor transaction volume, inspect webhook delivery, manage subscriptions, and audit administrative actions.
              </p>
            </div>

            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-3 lg:max-w-xl">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Merchants</div>
                <div className="mt-2 text-sm font-black text-white">{clients.length.toLocaleString()}</div>
                <div className="mt-1 text-xs text-slate-500">{activeMerchants.length.toLocaleString()} approved</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Approvals</div>
                <div className={`mt-2 text-sm font-black ${pendingApprovals.length > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {pendingApprovals.length.toLocaleString()} pending
                </div>
                <div className="mt-1 text-xs text-slate-500">{pendingApprovals.length > 0 ? 'Review required' : 'Queue clear'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Egypt time</div>
                <div className="mt-2 text-sm font-black text-white">{currentEgyptTime || 'Loading'}</div>
                <div className="mt-1 text-xs text-slate-500">DST mode: {dstMode}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        {platformStats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Total Clients"
              value={`${platformStats.totalClients}`}
              sub={`${platformStats.activeClients} active accounts`}
              tone="violet"
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Revenue (Today)"
              value={formatEgp(platformStats.today.totalEgp)}
              unit="EGP"
              sub={`${platformStats.today.count} transaction${platformStats.today.count === 1 ? '' : 's'}`}
              tone="emerald"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Volume (7 Days)"
              value={formatEgp(platformStats.sevenDays.totalEgp)}
              unit="EGP"
              sub={`${platformStats.sevenDays.count} transaction${platformStats.sevenDays.count === 1 ? '' : 's'}`}
              tone="blue"
            />
            <StatCard
              icon={<Activity className="h-5 w-5" />}
              label="Pending"
              value={formatEgp(platformStats.pending.totalEgp)}
              unit="EGP"
              sub={`${platformStats.pending.count} transaction${platformStats.pending.count === 1 ? '' : 's'}`}
              tone="amber"
            />
          </div>
        )}

        {/* Pending Approvals Section */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-2xl border border-amber-900/50 bg-amber-950/5 p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <UserCheck className="h-5 w-5 animate-pulse" />
              <h2 className="text-base font-bold">Pending Merchant Approvals ({pendingApprovals.length})</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingApprovals.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold text-white text-sm">{c.businessName}</h4>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold">
                        Awaiting Approval
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">Email: <span className="text-neutral-300 font-mono">{c.email}</span></p>
                    <p className="text-xs text-neutral-400">InstaPay: <span className="text-neutral-300 font-mono">{c.instapayHandle}</span></p>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 border-t border-neutral-900/60 pt-3">
                    <Button
                      size="sm"
                      onClick={() => handleRejectClient(c.id)}
                      className="bg-neutral-800 hover:bg-red-950/20 text-neutral-400 hover:text-red-400 border border-neutral-700 h-8 rounded-lg text-xs"
                    >
                      <ThumbsDown className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproveClient(c.id)}
                      className="bg-violet-600 hover:bg-violet-700 text-white h-8 rounded-lg text-xs font-semibold"
                    >
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      Approve & Activate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabbed Admin Workspace */}
        <div className="space-y-5">
            {/* Tabs Navigation */}
            <div className="sticky top-[73px] z-30 -mx-3 overflow-x-auto border-y border-neutral-900 bg-[#070a12]/95 px-3 py-3 backdrop-blur-xl sm:top-[73px] sm:mx-0 sm:rounded-2xl sm:border sm:bg-neutral-950/70">
              <div className="flex min-w-max gap-2 xl:grid xl:min-w-0 xl:grid-cols-9">
              {adminTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex min-w-[168px] items-start gap-3 rounded-2xl border p-3 text-left transition-all xl:min-w-0 ${
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
            </div>

            {/* TAB CONTENTS */}

            {/* Tab: Ops Center */}
            {activeTab === 'ops' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-violet-500/20 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.16),transparent_35%),rgba(23,23,23,.45)] p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Gauge className="h-5 w-5 text-violet-300" />
                        <h2 className="text-base font-black text-white">Operations command center</h2>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          healthScore >= 85
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : healthScore >= 65
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}>
                          {healthScore >= 85 ? 'Healthy' : healthScore >= 65 ? 'Needs attention' : 'Critical'}
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-xs leading-6 text-neutral-400">
                        Monitor gateway readiness, merchant risk, subscription blockers, setup gaps, and operational controls from one place.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                      {[
                        { label: 'Health score', value: `${healthScore}%`, tone: healthScore >= 85 ? 'text-emerald-300' : healthScore >= 65 ? 'text-amber-300' : 'text-red-300' },
                        { label: 'Ready merchants', value: `${configuredMerchants.length}/${activeMerchants.length}`, tone: 'text-cyan-300' },
                        { label: 'Open issues', value: operationalIssues.toLocaleString(), tone: operationalIssues > 0 ? 'text-amber-300' : 'text-emerald-300' },
                        { label: 'Pending tx', value: recentPendingCount.toLocaleString(), tone: recentPendingCount > 0 ? 'text-amber-300' : 'text-neutral-300' },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">{item.label}</div>
                          <div className={`mt-2 text-lg font-black ${item.tone}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 xl:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">Risk queue</h3>
                        <p className="mt-1 text-xs text-neutral-500">Prioritized admin actions affecting payment acceptance.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={loadData} disabled={refreshing} className="rounded-xl border-neutral-800 bg-neutral-950 text-neutral-300">
                        <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Recheck
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        {
                          title: 'Pending approvals',
                          count: pendingApprovals.length,
                          detail: 'New merchants waiting for review',
                          tone: 'amber',
                          action: () => setActiveTab('merchants'),
                        },
                        {
                          title: 'Expired subscriptions',
                          count: expiredMerchants.length,
                          detail: 'Merchants blocked by expiry',
                          tone: 'red',
                          action: () => setActiveTab('billing'),
                        },
                        {
                          title: 'Quota blocked',
                          count: quotaBlockedMerchants.length,
                          detail: 'Merchants at or above transaction limit',
                          tone: 'red',
                          action: () => setActiveTab('billing'),
                        },
                        {
                          title: 'Near quota',
                          count: nearQuotaMerchants.length,
                          detail: 'Merchants above 80% usage',
                          tone: 'amber',
                          action: () => setActiveTab('billing'),
                        },
                        {
                          title: 'Webhook missing',
                          count: merchantsMissingWebhook.length,
                          detail: 'Merchants without callback URL',
                          tone: 'violet',
                          action: () => setActiveTab('merchants'),
                        },
                        {
                          title: 'Detector/API setup missing',
                          count: merchantsMissingDetector.length,
                          detail: 'Merchants missing generated credentials',
                          tone: 'violet',
                          action: () => setActiveTab('merchants'),
                        },
                      ].map((item) => (
                        <button
                          key={item.title}
                          type="button"
                          onClick={item.action}
                          className="rounded-2xl border border-neutral-900 bg-neutral-950/55 p-4 text-left transition hover:border-violet-500/40 hover:bg-neutral-900/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-bold text-white">{item.title}</div>
                              <div className="mt-1 text-[11px] leading-5 text-neutral-500">{item.detail}</div>
                            </div>
                            <span className={`rounded-xl px-2.5 py-1 text-sm font-black ${
                              item.tone === 'red'
                                ? 'bg-red-500/10 text-red-300'
                                : item.tone === 'amber'
                                ? 'bg-amber-500/10 text-amber-300'
                                : 'bg-violet-500/10 text-violet-300'
                            }`}>
                              {item.count}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                        <Shield className="h-4 w-4 text-emerald-300" />
                        Security posture
                      </h3>
                      <div className="mt-4 space-y-3 text-xs">
                        {[
                          { label: 'Admin login uses email/password/TOTP', ok: true },
                          { label: 'Browser receives signed admin session token', ok: true },
                          { label: 'Raw owner secret remains server-side', ok: true },
                          { label: 'Critical admin mutations write audit logs', ok: true },
                        ].map((item) => (
                          <div key={item.label} className="flex items-start gap-2 rounded-xl border border-neutral-900 bg-neutral-950/60 p-3">
                            <CheckCircle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.ok ? 'text-emerald-400' : 'text-amber-400'}`} />
                            <span className="leading-5 text-neutral-400">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                        <Wrench className="h-4 w-4 text-cyan-300" />
                        Fast actions
                      </h3>
                      <div className="mt-4 grid gap-2">
                        <Button type="button" onClick={() => setShowAddModal(true)} className="justify-start rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                          <Plus className="mr-2 h-4 w-4" />
                          Create approved merchant
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setActiveTab('notifications')} className="justify-start rounded-xl border-neutral-800 bg-neutral-950 text-neutral-300">
                          <Bell className="mr-2 h-4 w-4" />
                          Send merchant notification
                        </Button>
                        <Button type="button" variant="outline" onClick={() => { setTxFilters({ q: '', status: 'PENDING', minAmount: '', maxAmount: '', startDate: '', endDate: '', clientId: '' }); setActiveTab('transactions') }} className="justify-start rounded-xl border-neutral-800 bg-neutral-950 text-neutral-300">
                          <Activity className="mr-2 h-4 w-4" />
                          Review pending payments
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setActiveTab('webhooks')} className="justify-start rounded-xl border-neutral-800 bg-neutral-950 text-neutral-300">
                          <Globe className="mr-2 h-4 w-4" />
                          Inspect webhook delivery
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5">
                    <h3 className="text-sm font-bold text-white">Subscription watchlist</h3>
                    <div className="mt-4 space-y-2">
                      {[...expiredMerchants, ...nearExpiryMerchants].slice(0, 6).map((merchant) => {
                        const remaining = daysRemaining(merchant.subscriptionEndsAt)
                        return (
                          <div key={merchant.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-900 bg-neutral-950/60 p-3">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-white">{merchant.businessName}</div>
                              <div className="text-[10px] text-neutral-500">{merchant.subscriptionPlan.replaceAll('_', ' ')}</div>
                            </div>
                            <span className={`shrink-0 text-[10px] font-bold ${remaining !== null && remaining <= 0 ? 'text-red-300' : 'text-amber-300'}`}>
                              {remaining !== null && remaining > 0 ? `${remaining}d left` : 'Expired'}
                            </span>
                          </div>
                        )
                      })}
                      {[...expiredMerchants, ...nearExpiryMerchants].length === 0 && (
                        <div className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-4 text-center text-xs text-neutral-500">No subscription expiry risk.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5">
                    <h3 className="text-sm font-bold text-white">Configuration gaps</h3>
                    <div className="mt-4 space-y-2">
                      {[...merchantsMissingWebhook, ...merchantsMissingDetector].filter((merchant, index, arr) => arr.findIndex((item) => item.id === merchant.id) === index).slice(0, 6).map((merchant) => (
                        <div key={merchant.id} className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-3">
                          <div className="truncate text-xs font-bold text-white">{merchant.businessName}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {!merchant.webhookUrl && <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">No webhook</span>}
                            {!merchant.apiKey && <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">No API key</span>}
                            {!merchant.detectToken && <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">No detector token</span>}
                          </div>
                        </div>
                      ))}
                      {merchantsMissingWebhook.length + merchantsMissingDetector.length === 0 && (
                        <div className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-4 text-center text-xs text-neutral-500">All approved merchants have core configuration.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5">
                    <h3 className="text-sm font-bold text-white">Recent payment signal</h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500">Confirmed</div>
                        <div className="mt-1 text-xl font-black text-emerald-300">{recentConfirmedCount}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500">Pending</div>
                        <div className="mt-1 text-xl font-black text-amber-300">{recentPendingCount}</div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {recentTx.slice(0, 5).map((tx) => (
                        <div key={tx.sessionId} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-900 bg-neutral-950/60 p-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-white">{tx.businessName}</div>
                            <div className="font-mono text-[10px] text-neutral-500">{tx.senderHandle}</div>
                          </div>
                          <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${tx.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                            {tx.status}
                          </span>
                        </div>
                      ))}
                      {recentTx.length === 0 && (
                        <div className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-4 text-center text-xs text-neutral-500">No recent transactions.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Tab: Merchants */}
            {activeTab === 'merchants' && (
              <div className="space-y-5">
                <div className="rounded-3xl border border-neutral-900 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.12),transparent_35%),rgba(23,23,23,.35)] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users className="h-5 w-5 text-violet-300" />
                        <h2 className="text-lg font-black text-white">Merchant control center</h2>
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                          {activeMerchants.length.toLocaleString()} approved
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-xs leading-6 text-neutral-400">
                        Review merchant readiness, credentials, subscriptions, quota, revenue, and account controls from structured operational cards.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab('ops')}
                        className="rounded-xl border-neutral-800 bg-neutral-950 text-neutral-300 hover:bg-neutral-900"
                      >
                        <Gauge className="mr-2 h-4 w-4" />
                        Ops Center
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowAddModal(true)}
                        className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Merchant
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Active now', value: activeMerchants.filter((merchant) => merchant.isActive).length, tone: 'text-emerald-300' },
                      { label: 'Disabled', value: disabledApprovedMerchants.length, tone: disabledApprovedMerchants.length ? 'text-amber-300' : 'text-neutral-300' },
                      { label: 'Missing setup', value: [...merchantsMissingWebhook, ...merchantsMissingDetector].filter((merchant, index, arr) => arr.findIndex((item) => item.id === merchant.id) === index).length, tone: merchantsMissingWebhook.length + merchantsMissingDetector.length ? 'text-amber-300' : 'text-emerald-300' },
                      { label: 'Quota risk', value: nearQuotaMerchants.length, tone: nearQuotaMerchants.length ? 'text-red-300' : 'text-emerald-300' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-neutral-950/55 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">{item.label}</div>
                        <div className={`mt-2 text-xl font-black ${item.tone}`}>{item.value.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-neutral-900 bg-neutral-900/30 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Search merchants</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                        <Input
                          value={merchantFilters.q}
                          onChange={(e) => setMerchantFilters((prev) => ({ ...prev, q: e.target.value }))}
                          placeholder="Business name, email, InstaPay handle, slug..."
                          className="h-10 rounded-xl border-neutral-800 bg-neutral-950 pl-9 text-white placeholder:text-neutral-700"
                        />
                      </div>
                    </div>

                    <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Status</Label>
                        <select value={merchantFilters.status} onChange={(e) => setMerchantFilters((prev) => ({ ...prev, status: e.target.value }))} className="h-10 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-xs text-white outline-none focus:border-violet-500">
                          <option value="ALL">All</option>
                          <option value="ENABLED">Enabled</option>
                          <option value="DISABLED">Disabled</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Setup</Label>
                        <select value={merchantFilters.setup} onChange={(e) => setMerchantFilters((prev) => ({ ...prev, setup: e.target.value }))} className="h-10 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-xs text-white outline-none focus:border-violet-500">
                          <option value="ALL">All</option>
                          <option value="READY">Ready</option>
                          <option value="MISSING">Missing setup</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Risk</Label>
                        <select value={merchantFilters.subscription} onChange={(e) => setMerchantFilters((prev) => ({ ...prev, subscription: e.target.value }))} className="h-10 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-xs text-white outline-none focus:border-violet-500">
                          <option value="ALL">All</option>
                          <option value="EXPIRED">Expired</option>
                          <option value="NEAR_EXPIRY">Near expiry</option>
                          <option value="QUOTA_RISK">Quota risk</option>
                          <option value="BLOCKED">Quota blocked</option>
                          <option value="TRIAL">Trial</option>
                          <option value="PAID">Paid active</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sort</Label>
                        <select value={merchantFilters.sort} onChange={(e) => setMerchantFilters((prev) => ({ ...prev, sort: e.target.value }))} className="h-10 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-xs text-white outline-none focus:border-violet-500">
                          <option value="RISK">Highest risk</option>
                          <option value="REVENUE">Revenue</option>
                          <option value="TRANSACTIONS">Transactions</option>
                          <option value="NEWEST">Newest</option>
                          <option value="NAME">Name A-Z</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-900 pt-4">
                    <p className="text-xs text-neutral-500">
                      Showing <span className="font-bold text-neutral-200">{filteredMerchants.length}</span> of <span className="font-bold text-neutral-200">{activeMerchants.length}</span> approved merchants.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMerchantFilters({ q: '', status: 'ALL', setup: 'ALL', subscription: 'ALL', sort: 'RISK' })}
                      className="h-8 rounded-lg border border-neutral-800 text-xs text-neutral-400 hover:text-white"
                    >
                      Clear filters
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {activeMerchants.length === 0 ? (
                    <div className="rounded-3xl border border-neutral-900 bg-neutral-900/30 p-10 text-center">
                      <Users className="mx-auto h-8 w-8 text-neutral-700" />
                      <h3 className="mt-3 text-sm font-bold text-white">No approved merchants yet</h3>
                      <p className="mt-2 text-xs text-neutral-500">Approved merchant accounts will appear here after review.</p>
                    </div>
                  ) : filteredMerchants.length === 0 ? (
                    <div className="rounded-3xl border border-neutral-900 bg-neutral-900/30 p-10 text-center">
                      <Search className="mx-auto h-8 w-8 text-neutral-700" />
                      <h3 className="mt-3 text-sm font-bold text-white">No merchants match these filters</h3>
                      <p className="mt-2 text-xs text-neutral-500">Clear or relax the filters to show more accounts.</p>
                    </div>
                  ) : (
                    filteredMerchants.map((c) => {
                      const remaining = daysRemaining(c.subscriptionEndsAt)
                      const expired = remaining !== null && remaining <= 0
                      const nearLimit = c.txLimit > 0 && c.txCount >= c.txLimit * 0.8
                      const blocked = c.txLimit > 0 && c.txCount >= c.txLimit
                      const setupChecks = [
                        { label: 'API key', ok: Boolean(c.apiKey) },
                        { label: 'Detector', ok: Boolean(c.detectToken) },
                        { label: 'Webhook', ok: Boolean(c.webhookUrl) },
                        { label: 'Account', ok: c.isActive },
                      ]
                      const setupDone = setupChecks.filter((item) => item.ok).length

                      return (
                        <article
                          key={c.id}
                          className="overflow-hidden rounded-3xl border border-neutral-900 bg-neutral-900/25 shadow-2xl shadow-black/10 transition hover:border-violet-500/25"
                        >
                          <div className="border-b border-neutral-900 bg-neutral-950/45 p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="truncate text-xl font-black text-white">{c.businessName}</h3>
                                  <span className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px] font-bold text-neutral-400">/{c.slug}</span>
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${c.isActive ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-red-500/25 bg-red-500/10 text-red-300'}`}>
                                    {c.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    {c.isActive ? 'Enabled' : 'Disabled'}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${expired ? 'border-red-500/30 bg-red-500/10 text-red-300' : c.isFreeTrial ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300'}`}>
                                    <Calendar className="h-3 w-3" />
                                    {expired ? 'Expired' : c.subscriptionPlan.replaceAll('_', ' ')}
                                  </span>
                                </div>

                                <div className="grid gap-2 text-xs text-neutral-400 md:grid-cols-2 xl:grid-cols-3">
                                  <div className="min-w-0 rounded-xl border border-neutral-900 bg-neutral-950/50 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Email</div>
                                    <div className="mt-1 truncate font-mono text-neutral-200" title={c.email}>{c.email}</div>
                                  </div>
                                  <div className="min-w-0 rounded-xl border border-neutral-900 bg-neutral-950/50 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">InstaPay handle</div>
                                    <div className="mt-1 truncate font-mono text-neutral-200" title={c.instapayHandle}>{c.instapayHandle}</div>
                                  </div>
                                  <div className="min-w-0 rounded-xl border border-neutral-900 bg-neutral-950/50 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Subscription</div>
                                    <div className={`mt-1 font-bold ${expired ? 'text-red-300' : remaining !== null && remaining <= 3 ? 'text-amber-300' : 'text-neutral-200'}`}>
                                      {remaining === null ? 'No expiry' : remaining > 0 ? `${remaining} day${remaining === 1 ? '' : 's'} remaining` : 'Expired'}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                                <div className="rounded-2xl border border-neutral-900 bg-neutral-950/60 p-4">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Revenue</div>
                                  <div className="mt-1 text-lg font-black text-emerald-300">{formatEgp(c.confirmedVolume)}</div>
                                  <div className="text-[10px] text-neutral-600">EGP confirmed</div>
                                </div>
                                <div className="rounded-2xl border border-neutral-900 bg-neutral-950/60 p-4">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Transactions</div>
                                  <div className="mt-1 text-lg font-black text-white">{c.totalTransactions.toLocaleString()}</div>
                                  <div className="text-[10px] text-neutral-600">all time</div>
                                </div>
                                <div className="col-span-2 rounded-2xl border border-neutral-900 bg-neutral-950/60 p-4 sm:col-span-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Setup</div>
                                  <div className="mt-1 text-lg font-black text-cyan-300">{setupDone}/4</div>
                                  <div className="text-[10px] text-neutral-600">ready checks</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 p-5 xl:grid-cols-[1.05fr_1fr_auto]">
                            <div className="space-y-4">
                              <div>
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="font-bold text-neutral-400">Monthly quota usage</span>
                                  <span className={`font-black ${blocked ? 'text-red-300' : nearLimit ? 'text-amber-300' : 'text-neutral-200'}`}>
                                    {c.txCount.toLocaleString()} / {c.txLimit.toLocaleString()}
                                  </span>
                                </div>
                                <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-neutral-800 bg-neutral-950">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${blocked ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-gradient-to-r from-violet-600 to-cyan-400'}`}
                                    style={{ width: `${usagePercent(c.txCount, c.txLimit)}%` }}
                                  />
                                </div>
                                {blocked && <p className="mt-2 text-[10px] font-semibold text-red-300">Quota reached — checkout creation is blocked until renewal or upgrade.</p>}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {setupChecks.map((item) => (
                                  <span key={item.label} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${item.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>
                                    {item.ok ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                    {item.label}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-neutral-900 bg-neutral-950/45 p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400">Secure credentials</h4>
                                {copiedText?.endsWith(c.id) && <span className="text-[10px] font-bold text-emerald-300">Copied</span>}
                              </div>
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-900 bg-neutral-900/45 p-3">
                                  <span className="flex items-center gap-2 text-neutral-500"><Key className="h-3.5 w-3.5" /> API key</span>
                                  <button type="button" onClick={() => c.apiKey && copyToClipboard(c.apiKey, `api-${c.id}`)} disabled={!c.apiKey} className="flex min-w-0 items-center gap-2 font-mono text-neutral-300 disabled:opacity-40">
                                    <span className="truncate">{maskSecret(c.apiKey)}</span><Copy className="h-3.5 w-3.5 shrink-0" />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-900 bg-neutral-900/45 p-3">
                                  <span className="flex items-center gap-2 text-neutral-500"><Smartphone className="h-3.5 w-3.5" /> Detector token</span>
                                  <button type="button" onClick={() => c.detectToken && copyToClipboard(c.detectToken, `det-${c.id}`)} disabled={!c.detectToken} className="flex min-w-0 items-center gap-2 font-mono text-neutral-300 disabled:opacity-40">
                                    <span className="truncate">{maskSecret(c.detectToken)}</span><Copy className="h-3.5 w-3.5 shrink-0" />
                                  </button>
                                </div>
                                <div className="rounded-xl border border-neutral-900 bg-neutral-900/45 p-3">
                                  <div className="flex items-center gap-2 text-neutral-500"><Globe className="h-3.5 w-3.5" /> Webhook URL</div>
                                  <div className="mt-1 truncate font-mono text-neutral-300" title={c.webhookUrl || undefined}>{c.webhookUrl || 'Not configured'}</div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:w-56 xl:flex-col">
                              <div className="col-span-2 rounded-2xl border border-neutral-900 bg-neutral-950/55 p-3 sm:col-span-3 xl:col-span-1">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Plan control</Label>
                                <select
                                  value={c.subscriptionPlan}
                                  disabled={subscriptionUpdatingId === c.id}
                                  onChange={(event) => handleSwapMerchantPlan(c, event.target.value)}
                                  className="mt-2 h-9 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-xs font-bold text-white outline-none transition focus:border-violet-500 disabled:opacity-50"
                                >
                                  {subscriptionPlanOptions.map((plan) => (
                                    <option key={plan.id} value={plan.name}>
                                      {plan.name.replaceAll('_', ' ')} · {plan.maxTransactions.toLocaleString()} tx
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-2 text-[10px] leading-4 text-neutral-600">
                                  Switching applies the selected plan quota and renews its duration.
                                </p>
                              </div>
                              <Button size="sm" onClick={() => { setTxFilters({ q: '', status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '', clientId: c.id }); setActiveTab('transactions') }} className="justify-start rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                                <Activity className="mr-2 h-4 w-4" /> Transactions
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleUpdateSubscription(c.id, 'FREE_TRIAL', true, 1)} disabled={subscriptionUpdatingId === c.id} className="justify-start rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-amber-950">
                                <Calendar className="mr-2 h-4 w-4" /> +1d trial
                              </Button>
                              <Button size="sm" variant="outline" asChild className="justify-start rounded-xl border-neutral-800 bg-neutral-950 text-neutral-300 hover:bg-neutral-900">
                                <a href={`/pay/${c.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Pay page</a>
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleToggleClientStatus(c.id, c.isActive)} className={`justify-start rounded-xl ${c.isActive ? 'text-amber-300 hover:bg-amber-500/10' : 'text-emerald-300 hover:bg-emerald-500/10'}`}>
                                {c.isActive ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                {c.isActive ? 'Disable' : 'Enable'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteClient(c.id)} className="justify-start rounded-xl text-red-300 hover:bg-red-500/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </Button>
                            </div>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab: Billing */}
            {activeTab === 'notifications' && (
              <form onSubmit={sendMerchantNotification} className="space-y-5 rounded-2xl border border-violet-500/20 bg-neutral-900/30 p-5">
                <div><h2 className="flex items-center gap-2 text-base font-bold text-white"><Bell className="h-4 w-4 text-violet-300" />Merchant notifications</h2><p className="mt-1 text-xs leading-6 text-neutral-500">Send a message that appears on the merchant website and as an Android detector notification.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label className="text-xs text-neutral-400">Merchant</Label><select required value={notificationClientId} onChange={(e) => setNotificationClientId(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm text-white"><option value="">Select a merchant</option>{clients.filter((client) => client.isActive).map((client) => <option key={client.id} value={client.id}>{client.businessName} · {client.email}</option>)}</select></div>
                  <div><Label className="text-xs text-neutral-400">Title</Label><Input required maxLength={120} value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} className="mt-2 border-neutral-800 bg-neutral-950 text-white" placeholder="System update" /></div>
                  <div><Label className="text-xs text-neutral-400">Priority</Label><select value={notificationSeverity} onChange={(e) => setNotificationSeverity(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm text-white"><option>INFO</option><option>SUCCESS</option><option>WARNING</option><option>URGENT</option></select></div>
                  <div className="sm:col-span-2"><Label className="text-xs text-neutral-400">Message</Label><textarea required maxLength={2000} value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} className="mt-2 min-h-32 w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-white outline-none focus:border-violet-500" placeholder="Write the message for this merchant..." /></div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`min-h-4 text-xs ${notificationResult?.includes('successfully') ? 'text-emerald-400' : 'text-amber-400'}`}>{notificationResult}</p>
                  <Button disabled={notificationSending} className="w-full bg-violet-600 text-white hover:bg-violet-700 sm:w-auto">
                    <Bell className="mr-2 h-4 w-4" />
                    {notificationSending ? 'Sending...' : 'Send notification'}
                  </Button>
                </div>
              </form>
            )}

            {/* Tab: Billing */}
            {activeTab === 'billing' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">Subscription operations</h2>
                      <p className="mt-1 text-xs leading-6 text-neutral-500">
                        Control gateway pricing, monthly transaction limits, and merchant subscription state from one place.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Recurring plans</div>
                      <div className="mt-1 text-lg font-black text-white">{plans.filter((plan) => plan.name !== 'FREE_TRIAL').length}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {plans.filter((plan) => plan.name !== 'FREE_TRIAL').map((plan) => {
                    const draft = planDrafts[plan.name] || { priceEgp: String(plan.priceEgp), maxTransactions: String(plan.maxTransactions) }
                    return (
                      <div key={plan.id} className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-black text-white">{plan.name}</h3>
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                              Public plan
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-neutral-500">
                            Merchants activate this plan after the exact subscription payment is confirmed.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-neutral-500">Monthly price</Label>
                            <Input
                              type="number"
                              min="1"
                              value={draft.priceEgp}
                              onChange={(e) => setPlanDrafts((prev) => ({
                                ...prev,
                                [plan.name]: { ...draft, priceEgp: e.target.value },
                              }))}
                              className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-neutral-500">Tx limit</Label>
                            <Input
                              type="number"
                              min="1"
                              value={draft.maxTransactions}
                              onChange={(e) => setPlanDrafts((prev) => ({
                                ...prev,
                                [plan.name]: { ...draft, maxTransactions: e.target.value },
                              }))}
                              className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={() => handleUpdatePlan(plan.name)}
                          disabled={planSaving === plan.name}
                          className="w-full rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                        >
                          {planSaving === plan.name ? 'Saving plan…' : 'Save pricing and limit'}
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 overflow-hidden">
                  <div className="border-b border-neutral-900 bg-neutral-950/40 px-4 py-3">
                    <h3 className="text-sm font-bold text-white">Merchant subscription health</h3>
                    <p className="mt-1 text-xs text-neutral-500">Renew, upgrade, expire, and monitor quota usage.</p>
                  </div>
                  <div className="divide-y divide-neutral-900">
                    {activeMerchants.length === 0 ? (
                      <div className="p-8 text-center text-xs text-neutral-600">No approved merchants yet.</div>
                    ) : activeMerchants.map((merchant) => {
                      const remaining = daysRemaining(merchant.subscriptionEndsAt)
                      const expired = remaining !== null && remaining <= 0
                      const nearLimit = merchant.txLimit > 0 && merchant.txCount >= merchant.txLimit * 0.8
                      return (
                        <div key={merchant.id} className="grid gap-4 p-4 lg:grid-cols-[1.3fr_1fr_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-bold text-white">{merchant.businessName}</h4>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                expired
                                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                  : merchant.isFreeTrial
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              }`}>
                                {expired ? 'Expired' : merchant.isFreeTrial ? 'Trial' : 'Active'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-neutral-500">
                              {merchant.email} · {merchant.subscriptionPlan.replaceAll('_', ' ')}
                              {remaining !== null && ` · ${remaining > 0 ? `${remaining} days remaining` : 'expired'}`}
                            </p>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-neutral-500">
                              <span>Quota usage</span>
                              <span>{merchant.txCount.toLocaleString()} / {merchant.txLimit.toLocaleString()}</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-neutral-800 bg-neutral-950">
                              <div
                                className={`h-full rounded-full ${expired ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-gradient-to-r from-violet-600 to-indigo-500'}`}
                                style={{ width: `${usagePercent(merchant.txCount, merchant.txLimit)}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 lg:min-w-64">
                            <select
                              value={merchant.subscriptionPlan}
                              disabled={subscriptionUpdatingId === merchant.id}
                              onChange={(event) => handleSwapMerchantPlan(merchant, event.target.value)}
                              className="h-9 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-xs font-bold text-white outline-none transition focus:border-violet-500 disabled:opacity-50"
                            >
                              {subscriptionPlanOptions.map((plan) => (
                                <option key={plan.id} value={plan.name}>
                                  {plan.name.replaceAll('_', ' ')} · {plan.maxTransactions.toLocaleString()} tx
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={subscriptionUpdatingId === merchant.id}
                              onClick={() => handleUpdateSubscription(merchant.id, 'EXPIRED', false, -1)}
                              className="h-8 rounded-lg text-xs text-red-400 hover:bg-red-500/10"
                            >
                              Expire
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Transactions */}
            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/30 p-4 rounded-2xl border border-neutral-900">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white">
                      {txFilters.clientId 
                        ? `Transactions for ${clients.find(c => c.id === txFilters.clientId)?.businessName || 'Merchant'}` 
                        : 'All Platform Transactions'}
                    </h3>
                    <p className="text-xs text-neutral-500 font-medium">Search and audit checkouts across the entire payment platform.</p>
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
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Search Keyword</Label>
                      <Input
                        type="text"
                        placeholder="Sender, Ref code, Session ID..."
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
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Min Amount (EGP)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={txFilters.minAmount}
                        onChange={(e) => setTxFilters({ ...txFilters, minAmount: e.target.value })}
                        className="h-8 text-xs rounded-lg border-neutral-800 bg-neutral-950/80 text-white placeholder-neutral-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Max Amount (EGP)</Label>
                      <Input
                        type="number"
                        placeholder="1000.00"
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
                    <div className="space-y-1">
                      <Label className="text-[10px] text-neutral-400 uppercase font-bold">Filter Merchant</Label>
                      <select
                        value={txFilters.clientId}
                        onChange={(e) => setTxFilters({ ...txFilters, clientId: e.target.value })}
                        className="w-full h-8 px-2.5 rounded-lg border border-neutral-800 bg-neutral-950/80 text-white text-xs outline-none focus:border-violet-500"
                      >
                        <option value="">All Merchants</option>
                        {clients.filter(c => c.approvalStatus === 'APPROVED').map(c => (
                          <option key={c.id} value={c.id}>{c.businessName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        onClick={loadTransactions}
                        disabled={txLoading}
                        className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex-1"
                      >
                        <Filter className="mr-1 h-3.5 w-3.5" />
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTxFilters({ q: '', status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '', clientId: '' })
                          setTimeout(() => loadTransactions(), 100)
                        }}
                        className="h-8 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white text-xs"
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
                        className="rounded-xl border border-neutral-900 bg-neutral-900/30 p-4 flex flex-col sm:flex-row justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{tx.senderHandle}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-700" />
                            <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded font-semibold">
                              {tx.businessName}
                            </span>
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
                          <p className="text-[9px] text-neutral-600">
                            Created: {tx.createdAtEgypt} {tx.detectedAtEgypt && ` · Confirmed: ${tx.detectedAtEgypt}`}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-black text-white text-sm">+{formatEgp(tx.amountEgp)} EGP</span>
                          </div>
                          {tx.status === 'PENDING' && (
                            <Button
                              size="sm"
                              onClick={() => handleForceConfirm(tx.sessionId)}
                              className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                            >
                              Force Confirm
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Webhook Logs */}
            {activeTab === 'webhooks' && (
              <div className="space-y-4">
                <div className="space-y-0.5 bg-neutral-900/30 p-4 rounded-2xl border border-neutral-900">
                  <h3 className="text-sm font-bold text-white">Webhook Delivery Log</h3>
                  <p className="text-xs text-neutral-500 font-medium">Track delivery status codes, timeouts, and callbacks to merchant endpoints.</p>
                </div>

                {/* Filters card */}
                <div className="bg-neutral-900/20 border border-neutral-900 p-4 rounded-2xl flex flex-wrap items-end gap-3">
                  <div className="space-y-1 flex-1 min-w-[150px]">
                    <Label className="text-[10px] text-neutral-400 uppercase font-bold">Merchant</Label>
                    <select
                      value={webhookFilters.clientId}
                      onChange={(e) => setWebhookFilters({ ...webhookFilters, clientId: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg border border-neutral-800 bg-neutral-950/80 text-white text-xs outline-none focus:border-violet-500"
                    >
                      <option value="">All Merchants</option>
                      {clients.filter(c => c.approvalStatus === 'APPROVED').map(c => (
                        <option key={c.id} value={c.id}>{c.businessName}</option>
                      ))}
                    </select>
                  </div>
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
                        setWebhookFilters({ success: '', clientId: '' })
                        setTimeout(() => loadWebhookLogs(), 100)
                      }}
                      className="h-8 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white text-xs"
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Logs list */}
                <div className="space-y-2">
                  {webhookLoading ? (
                    <div className="py-12 text-center text-xs text-neutral-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-violet-500 mb-2" />
                      Loading logs...
                    </div>
                  ) : webhookLogs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-600 border border-neutral-900 rounded-2xl bg-neutral-900/10">
                      No webhook logs recorded.
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
                            <span className="font-bold text-white">{log.businessName}</span>
                            <span className="text-[10px] text-neutral-500 font-mono">({log.event})</span>
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

            {/* Tab: Audit Logs */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="space-y-0.5 bg-neutral-900/30 p-4 rounded-2xl border border-neutral-900">
                  <h3 className="text-sm font-bold text-white">System Audit Log</h3>
                  <p className="text-xs text-neutral-500 font-medium">Security history tracking administrative operations and updates.</p>
                </div>

                <div className="rounded-2xl border border-neutral-900 overflow-hidden bg-neutral-900/20">
                  <div className="max-h-[500px] overflow-auto">
                    {auditLoading ? (
                      <div className="py-12 text-center text-xs text-neutral-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-violet-500 mb-2" />
                        Loading audit logs...
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="py-12 text-center text-xs text-neutral-600">No events logged.</div>
                    ) : (
                      <table className="min-w-[720px] w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-neutral-900 bg-neutral-950/40 text-neutral-500 font-semibold">
                            <th className="px-4 py-3">Timestamp</th>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="border-b border-neutral-900/60 hover:bg-neutral-900/10">
                              <td className="px-4 py-3 whitespace-nowrap text-neutral-400">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded bg-neutral-800 px-2 py-0.5 font-bold font-mono text-[10px] text-violet-400">
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-neutral-300 leading-normal">{log.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Activity */}
            {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-neutral-400" />
              <h2 className="text-base font-bold text-white">Platform Activity</h2>
            </div>

            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 overflow-hidden">
              <div className="border-b border-neutral-900 px-4 py-3 bg-neutral-950/40">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Latest Transactions</span>
              </div>
              <ScrollArea className="h-[480px]">
                <div className="p-3 space-y-2">
                  {recentTx.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-600">No transactions recorded yet.</div>
                  ) : (
                    recentTx.map((tx) => (
                      <div
                        key={tx.sessionId}
                        className="rounded-xl bg-neutral-950/50 p-3 border border-neutral-900 flex justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate max-w-[120px]">{tx.senderHandle}</span>
                            <ChevronRight className="h-3 w-3 text-neutral-600" />
                            <span className="text-[10px] text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={tx.businessName}>
                              {tx.businessName}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 mt-1 font-mono">{tx.detectedRef || tx.sessionId.slice(0, 12)}</p>
                          <span className="text-[9px] text-neutral-600 block mt-0.5">{tx.detectedAtEgypt || new Date(tx.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-white">+{formatEgp(tx.amountEgp)}</span>
                          <span
                            className={`block text-[9px] font-bold uppercase mt-1 ${
                              tx.status === 'CONFIRMED'
                                ? 'text-emerald-400'
                                : tx.status === 'PENDING'
                                ? 'text-amber-400'
                                : 'text-neutral-500'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

          </div>
            )}

            {/* Tab: Settings */}
            {activeTab === 'settings' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* System settings card */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-neutral-400" />
                <h3 className="text-sm font-bold text-white">System Timezone & DST</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-900 space-y-2">
                  <div className="flex justify-between text-neutral-400">
                    <span>Region Timezone</span>
                    <span className="text-white font-semibold">Africa/Cairo</span>
                  </div>
                  <div className="flex justify-between text-neutral-400 border-t border-neutral-900/60 pt-2">
                    <span>Current Egypt Time</span>
                    <span className="text-violet-400 font-mono font-bold">{currentEgyptTime || 'Loading...'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-neutral-400 block font-medium">Egypt DST / Summer Time Control</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['AUTO', 'SUMMER', 'WINTER'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={updatingSettings}
                        onClick={() => handleUpdateDstMode(mode)}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all ${
                          dstMode === mode
                            ? 'bg-violet-600/10 border-violet-500 text-violet-400'
                            : 'bg-neutral-950/40 border-neutral-900 text-neutral-400 hover:border-neutral-800'
                        }`}
                      >
                        {mode === 'AUTO' ? 'Auto (Cairo)' : mode === 'SUMMER' ? 'Forced Summer' : 'Forced Winter'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-600 leading-normal">
                    * AUTO uses standard laws (UTC+3 Summer, UTC+2 Winter). Force overrides DST mode globally across dashboard statistics and lists.
                  </p>
                </div>
              </div>
            </div>

            {/* Admin App download card */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-neutral-400" />
                <h3 className="text-sm font-bold text-white">Administrative Android App</h3>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-neutral-400 leading-normal">
                  Manage approved merchants, view system transaction feeds, and override checkout statuses directly from your phone.
                </p>

                <a
                  href="/apks/InstaPay-Admin.apk"
                  download
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-white transition-all"
                >
                  <Download className="h-3.5 w-3.5 text-blue-500" />
                  Download Admin APK
                </a>
              </div>
            </div>

          </div>
            )}
        </div>
      </main>

      {/* Add Client Dialog Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl sm:p-6 space-y-4"
            >
              <div>
                <h3 className="text-lg font-bold text-white">Register Merchant (Direct Setup)</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Create a pre-approved active merchant account.
                </p>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="businessName" className="text-xs text-neutral-300">
                    Business / Merchant Name
                  </Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="e.g. Ahmed Electronics"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="instapayHandle" className="text-xs text-neutral-300">
                    InstaPay Handle
                  </Label>
                  <Input
                    id="instapayHandle"
                    type="text"
                    placeholder="e.g. businessname@instapay"
                    value={instapayHandle}
                    onChange={(e) => setInstapayHandle(e.target.value)}
                    className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emailInput" className="text-xs text-neutral-300">
                    Merchant Email Address
                  </Label>
                  <Input
                    id="emailInput"
                    type="email"
                    placeholder="e.g. shop@merchant.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="webhookUrl" className="text-xs text-neutral-300">
                    Webhook URL (Optional)
                  </Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    placeholder="https://client-project.com/api/webhooks/payment"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ttl" className="text-xs text-neutral-300">
                    Checkout Expiration Time (Minutes)
                  </Label>
                  <Input
                    id="ttl"
                    type="number"
                    min="1"
                    max="180"
                    value={checkoutTtlMin}
                    onChange={(e) => setCheckoutTtlMin(e.target.value)}
                    className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white focus-visible:ring-violet-500"
                    required
                  />
                </div>

                {modalError && (
                  <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddModal(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingClient}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold"
                  >
                    {savingClient ? 'Saving…' : 'Create Merchant'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Credentials Created Dialog */}
      <AnimatePresence>
        {createdCredentials && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-3xl border border-emerald-900/50 bg-neutral-900 p-4 shadow-2xl sm:p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Merchant Created</h3>
                  <p className="text-xs text-neutral-400">{createdCredentials.businessName}</p>
                </div>
              </div>

              <div className="bg-neutral-950 rounded-2xl border border-neutral-800 p-4 space-y-3">
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">⚠ Save these credentials — password cannot be retrieved later</p>
                
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500 font-semibold uppercase">Login Email</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-white font-mono bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-800 select-all">
                      {createdCredentials.email}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.email)
                        setCopiedText('email')
                        setTimeout(() => setCopiedText(null), 2000)
                      }}
                      className="text-neutral-400 hover:text-white h-8 w-8 p-0"
                    >
                      {copiedText === 'email' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500 font-semibold uppercase">Password</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-emerald-400 font-mono font-bold bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-800 select-all">
                      {showPassword ? createdCredentials.password : '••••••••'}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-neutral-400 hover:text-white h-8 w-8 p-0"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.password)
                        setCopiedText('password')
                        setTimeout(() => setCopiedText(null), 2000)
                      }}
                      className="text-neutral-400 hover:text-white h-8 w-8 p-0"
                    >
                      {copiedText === 'password' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setCreatedCredentials(null)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold"
              >
                Done
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
                    <div>
                      <span className="text-neutral-500 font-semibold block">Merchant</span>
                      <span className="block font-bold text-white mt-0.5">{selectedLogDetail.businessName}</span>
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
  tone: 'violet' | 'emerald' | 'blue' | 'amber'
}) {
  const tones = {
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', ring: 'border-violet-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'border-emerald-500/20' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'border-blue-500/20' },
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
