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
  Calendar,
  DollarSign
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

export default function AdminPortalPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params)
  const expectedHash = process.env.NEXT_PUBLIC_ADMIN_PORTAL_PATH || 'secure-control-shabana-88123'

  // Security through obscurity verification
  if (hash !== expectedHash) {
    notFound()
  }

  const [token, setToken] = useState<string | null>(null)
  const [secretInput, setSecretInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  // Platform data
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [clients, setClients] = useState<ClientStats[]>([])
  const [recentTx, setRecentTx] = useState<RecentTx[]>([])
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

  const [copiedText, setCopiedText] = useState<string | null>(null)

  const [dstMode, setDstMode] = useState<'AUTO' | 'SUMMER' | 'WINTER'>('AUTO')
  const [currentEgyptTime, setCurrentEgyptTime] = useState('')
  const [updatingSettings, setUpdatingSettings] = useState(false)

  // Advanced features states
  const [activeTab, setActiveTab] = useState<'merchants' | 'transactions' | 'webhooks' | 'audit'>('merchants')
  const [allTransactions, setAllTransactions] = useState<any[]>([])
  const [webhookLogs, setWebhookLogs] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])

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
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('owner_secret_token')
    if (saved) {
      setToken(saved)
    }
  }, [])

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secretInput }),
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
    setSecretInput('')
  }

  const loadData = async () => {
    if (!token) return
    setRefreshing(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      
      const statsRes = await fetch('/api/admin/dashboard', { headers })
      const statsData = await statsRes.json()
      
      const clientsRes = await fetch('/api/admin/clients', { headers })
      const clientsData = await clientsRes.json()

      const settingsRes = await fetch('/api/settings', { headers })
      const settingsData = await settingsRes.json()

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const pendingApprovals = clients.filter((c) => c.approvalStatus === 'PENDING')
  const activeMerchants = clients.filter((c) => c.approvalStatus === 'APPROVED')

  // --- Render Login Page ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-indigo-950 p-4 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-indigo-400 shadow-md">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Platform Admin Login</h1>
            <p className="text-sm text-neutral-400">
              Enter platform owner secret key to access setup controls.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secret" className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Admin secret key
              </Label>
              <Input
                id="secret"
                type="password"
                placeholder="Paste OWNER_SECRET token…"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                className="h-11 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus-visible:ring-violet-500"
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
              className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 hover:from-violet-700 hover:to-indigo-700"
            >
              Sign In
            </Button>
          </form>
        </motion.div>
      </div>
    )
  }

  // --- Render Dashboard UI ---
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-emerald-400 shadow-md">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">InstaPay Gateway</h1>
                <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-400 border border-violet-500/30">
                  Platform Admin
                </span>
              </div>
              <p className="text-xs text-neutral-500">Secure Obscured Router Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={refreshing}
              className="text-neutral-400 border-neutral-800 hover:bg-neutral-900 hover:text-white"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-neutral-500 hover:text-red-400 hover:bg-red-500/10"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* Stats Grid */}
        {platformStats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
              value={`${platformStats.today.totalEgp.toFixed(2)}`}
              unit="EGP"
              sub={`${platformStats.today.count} transaction${platformStats.today.count === 1 ? '' : 's'}`}
              tone="emerald"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Volume (7 Days)"
              value={`${platformStats.sevenDays.totalEgp.toFixed(2)}`}
              unit="EGP"
              sub={`${platformStats.sevenDays.count} transaction${platformStats.sevenDays.count === 1 ? '' : 's'}`}
              tone="blue"
            />
            <StatCard
              icon={<Activity className="h-5 w-5" />}
              label="Pending"
              value={`${platformStats.pending.totalEgp.toFixed(2)}`}
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
                    <div className="flex items-center justify-between">
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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Navigable Tabs System */}
          <div className="lg:col-span-2 space-y-5">
            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 border-b border-neutral-900 pb-2 overflow-x-auto">
              {[
                { id: 'merchants', label: 'Active Merchants', icon: <Users className="h-4 w-4" /> },
                { id: 'transactions', label: 'Platform Transactions', icon: <Activity className="h-4 w-4" /> },
                { id: 'webhooks', label: 'Webhook Deliveries', icon: <Globe className="h-4 w-4" /> },
                { id: 'audit', label: 'Audit Logs', icon: <Shield className="h-4 w-4" /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wider whitespace-nowrap transition-all border ${
                    activeTab === t.id
                      ? 'bg-violet-600/10 border-violet-500 text-violet-400 font-bold shadow-md shadow-violet-600/5'
                      : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-neutral-900/40'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENTS */}
            
            {/* Tab: Merchants */}
            {activeTab === 'merchants' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-neutral-400" />
                    <h2 className="text-base font-bold text-white">Active Merchants</h2>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowAddModal(true)}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Create Merchant (Direct)
                  </Button>
                </div>

                {/* Clients Cards */}
                <div className="space-y-3">
                  {activeMerchants.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-8 text-center text-neutral-500">
                      No active approved merchants found. Approved clients will show up here.
                    </div>
                  ) : (
                    activeMerchants.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 hover:border-neutral-800 transition-all flex flex-col md:flex-row justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-white truncate">{c.businessName}</h3>
                            <span className="font-mono text-xs text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded">
                              /{c.slug}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                c.isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {c.isActive ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                              {c.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-neutral-400">
                            <div>
                              <span className="text-neutral-600 font-medium">InstaPay Handle:</span>{' '}
                              <span className="font-mono font-semibold text-neutral-300">{c.instapayHandle}</span>
                            </div>
                            <div>
                              <span className="text-neutral-600 font-medium">Email Address:</span>{' '}
                              <span className="font-mono font-semibold text-neutral-300">{c.email}</span>
                            </div>
                          </div>

                          {/* Keys & Tokens */}
                          {c.apiKey && c.detectToken && (
                            <div className="space-y-1 bg-neutral-950/60 p-3 rounded-xl border border-neutral-900 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-neutral-500 flex items-center gap-1 font-medium">
                                  <Key className="h-3 w-3" /> API Key (apiKey)
                                </span>
                                <div className="flex items-center gap-1.5 font-mono text-neutral-400 select-all">
                                  <span>{c.apiKey}</span>
                                  <button
                                    onClick={() => copyToClipboard(c.apiKey!, `api-${c.id}`)}
                                    className="text-neutral-600 hover:text-neutral-300 transition-colors"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  {copiedText === `api-${c.id}` && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 border-t border-neutral-900/60 pt-1.5 mt-1.5">
                                <span className="text-neutral-500 flex items-center gap-1 font-medium">
                                  <Smartphone className="h-3 w-3" /> APK Token (detectToken)
                                </span>
                                <div className="flex items-center gap-1.5 font-mono text-neutral-400 select-all">
                                  <span>{c.detectToken}</span>
                                  <button
                                    onClick={() => copyToClipboard(c.detectToken!, `det-${c.id}`)}
                                    className="text-neutral-600 hover:text-neutral-300 transition-colors"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  {copiedText === `det-${c.id}` && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
                                </div>
                              </div>

                              {c.webhookUrl && (
                                <div className="flex items-center justify-between gap-2 border-t border-neutral-900/60 pt-1.5 mt-1.5">
                                  <span className="text-neutral-500 flex items-center gap-1 font-medium">
                                    <Globe className="h-3 w-3" /> Webhook URL
                                  </span>
                                  <span className="font-mono text-neutral-400 truncate max-w-[200px]" title={c.webhookUrl}>
                                    {c.webhookUrl}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Stats & Actions */}
                        <div className="flex md:flex-col justify-between items-end gap-2 border-t md:border-t-0 border-neutral-900 pt-3 md:pt-0 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] uppercase text-neutral-500 tracking-wider font-semibold">Total Revenue</span>
                            <div className="text-base font-black text-emerald-400 mt-0.5">
                              {c.confirmedVolume.toFixed(2)} <span className="text-[10px] font-normal text-neutral-500">EGP</span>
                            </div>
                            <span className="text-[10px] text-neutral-500 block">{c.totalTransactions} transactions</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-8 rounded-lg text-neutral-400 hover:text-white"
                            >
                              <a href={`/pay/${c.slug}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleClientStatus(c.id, c.isActive)}
                              className={`h-8 rounded-lg ${
                                c.isActive ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'
                              }`}
                            >
                              {c.isActive ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClient(c.id)}
                              className="h-8 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Transactions */}
            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/30 p-4 rounded-2xl border border-neutral-900">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white">All Platform Transactions</h3>
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
                            <span className="font-black text-white text-sm">+{tx.amountEgp.toFixed(2)} EGP</span>
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
                  <div className="max-h-[500px] overflow-y-auto">
                    {auditLoading ? (
                      <div className="py-12 text-center text-xs text-neutral-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-violet-500 mb-2" />
                        Loading audit logs...
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="py-12 text-center text-xs text-neutral-600">No events logged.</div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
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
          </div>

          {/* Right Column: Platform Activity */}
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
                          <span className="text-xs font-black text-white">+{tx.amountEgp.toFixed(2)}</span>
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

          </div>
        </div>
      </main>

      {/* Add Client Dialog Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative z-10 space-y-4"
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
      {/* Webhook Log Detail Modal */}
      <AnimatePresence>
        {selectedLogDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative z-10 space-y-4 max-h-[90vh] flex flex-col text-neutral-200"
            >
              <div>
                <h3 className="text-lg font-bold text-white">Webhook Attempt Detail</h3>
                <p className="text-xs text-neutral-500 mt-1">Delivery details for event: {selectedLogDetail.event}</p>
              </div>

              <ScrollArea className="flex-1 pr-1 space-y-4">
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 bg-neutral-900/40 p-3 rounded-xl border border-neutral-850">
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
                      {JSON.stringify(JSON.parse(selectedLogDetail.payload), null, 2)}
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
