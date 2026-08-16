'use client'

import { useEffect, useState } from 'react'
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
  AlertCircle
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
  apiKey: string
  detectToken: string
  webhookUrl: string | null
  isActive: boolean
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

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [secretInput, setSecretInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  // Platform data
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [clients, setClients] = useState<ClientStats[]>([])
  const [recentTx, setRecentTx] = useState<RecentTx[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Client creation dialog state
  const [showAddModal, setShowAddModal] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [instapayHandle, setInstapayHandle] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [checkoutTtlMin, setCheckoutTtlMin] = useState('10')
  const [modalError, setModalError] = useState<string | null>(null)
  const [savingClient, setSavingClient] = useState(false)

  // Copy helper
  const [copiedText, setCopiedText] = useState<string | null>(null)

  useEffect(() => {
    // Check if token exists in localStorage
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
      
      // Load platform stats
      const statsRes = await fetch('/api/admin/dashboard', { headers })
      const statsData = await statsRes.json()
      
      // Load clients
      const clientsRes = await fetch('/api/admin/clients', { headers })
      const clientsData = await clientsRes.json()

      if (statsData.ok && clientsData.ok) {
        setPlatformStats(statsData.stats)
        setRecentTx(statsData.recent)
        setClients(clientsData.clients)
      } else {
        if (statsRes.status === 401 || clientsRes.status === 401) {
          handleLogout()
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setRefreshing(false)
    }
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
          webhookUrl: webhookUrl || null,
          checkoutTtlMin: parseInt(checkoutTtlMin) || 10,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setShowAddModal(false)
        setBusinessName('')
        setInstapayHandle('')
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
    if (!confirm('Are you sure you want to delete this client? This will delete all their transactions.')) return
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

  // --- Render Login Page ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-indigo-950 p-4">
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
            <h1 className="text-xl font-bold text-white tracking-tight">Platform Admin login</h1>
            <p className="text-sm text-neutral-400">
              Enter your platform administrative secret key to access settings
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

          <div className="text-center">
            <p className="text-[10px] text-neutral-500">
              Default Sandbox Key: <span className="font-mono bg-neutral-950 px-1 py-0.5 rounded text-neutral-400">owner-sandbox-secret-token-2026</span>
            </p>
          </div>
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
              <p className="text-xs text-neutral-500">Egypt Instant Network Manager</p>
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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Clients List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-neutral-400" />
                <h2 className="text-base font-bold text-white">Merchant Clients</h2>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Client
              </Button>
            </div>

            {/* Clients Cards */}
            <div className="space-y-3">
              {clients.length === 0 ? (
                <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-8 text-center text-neutral-500">
                  No clients created yet. Click &ldquo;Add Client&rdquo; to get started.
                </div>
              ) : (
                clients.map((c) => (
                  <motion.div
                    key={c.id}
                    layoutId={c.id}
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
                          <span className="text-neutral-600 font-medium">Checkout TTL:</span>{' '}
                          <span className="font-semibold text-neutral-300">{c.checkoutTtlMin} mins</span>
                        </div>
                      </div>

                      {/* Keys & Tokens */}
                      <div className="space-y-1 bg-neutral-950/60 p-3 rounded-xl border border-neutral-900 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-neutral-500 flex items-center gap-1 font-medium">
                            <Key className="h-3 w-3" /> API Key (apiKey)
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-neutral-400 select-all">
                            <span>{c.apiKey}</span>
                            <button
                              onClick={() => copyToClipboard(c.apiKey, `api-${c.id}`)}
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
                              onClick={() => copyToClipboard(c.detectToken, `det-${c.id}`)}
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
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Platform Recent Activity */}
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
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-900 bg-neutral-950 py-5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center text-xs text-neutral-600">
          InstaPay Detector Platform Gateway Admin Panel · Sandbox Mode
        </div>
      </footer>

      {/* --- Add Client Dialog Modal --- */}
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
                <h3 className="text-lg font-bold text-white">Create Client Account</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Add an individual or business to let them integrate the gateway on their project.
                </p>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="businessName" className="text-xs text-neutral-300">
                    Business / Client Name
                  </Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="e.g. Ahmed Electronics, Book Shop"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="instapayHandle" className="text-xs text-neutral-300">
                    InstaPay Handle (Where customer funds are received)
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
                  <Label htmlFor="webhookUrl" className="text-xs text-neutral-300">
                    Webhook URL (Optional callback to their project server)
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
                    {savingClient ? 'Saving…' : 'Create Client'}
                  </Button>
                </div>
              </form>
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
