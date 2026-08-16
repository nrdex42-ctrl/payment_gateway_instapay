'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowDownLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Key,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  Terminal,
  TrendingUp,
  Wallet
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
  email: string
  apiKey: string | null
  detectToken: string | null
  webhookUrl: string | null
  webhookSecret: string | null
  checkoutTtlMin: number
  createdAt: string
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

interface Snippets {
  curl: string
  javascript: string
  python: string
  php: string
  nodeWebhook: string
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
  const [webhookUrlInput, setWebhookUrlInput] = useState('')
  const [checkoutTtlInput, setCheckoutTtlInput] = useState('10')
  const [updatingSettings, setUpdatingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSuccess, setSettingsSuccess] = useState(false)

  // Copy state
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (data.ok) {
          setClient(data.client)
          setWebhookUrlInput(data.client.webhookUrl || '')
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
    }
  }, [client])

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
          webhookUrl: webhookUrlInput || null,
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin text-violet-500 mx-auto" />
          <p className="text-xs">Validating login session…</p>
        </div>
      </div>
    )
  }

  if (!client) return null

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
                <h1 className="text-base font-bold text-white">{client.businessName}</h1>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/30">
                  Approved
                </span>
              </div>
              <p className="text-xs text-neutral-500">Merchant Console · Slug: <span className="font-semibold">/{client.slug}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
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
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Today's Confirmed"
              value={`${stats.today.totalEgp.toFixed(2)}`}
              unit="EGP"
              sub={`${stats.today.count} payments confirmed`}
              tone="emerald"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Last 7 Days"
              value={`${stats.sevenDays.totalEgp.toFixed(2)}`}
              unit="EGP"
              sub={`${stats.sevenDays.count} payments confirmed`}
              tone="violet"
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Pending"
              value={`${stats.pending.totalEgp.toFixed(2)}`}
              unit="EGP"
              sub={`${stats.pending.count} transactions awaiting confirmation`}
              tone="amber"
            />
          </div>
        )}

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Columns: Keys, Webhooks, Snippets */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Integration Keys Card */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-neutral-400" />
                <h2 className="text-base font-bold text-white">API Integration Credentials</h2>
              </div>

              <div className="space-y-3 bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-xs">
                {/* API Key */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-neutral-300 font-semibold flex items-center gap-1">
                      API Key (`apiKey`)
                    </span>
                    <p className="text-[10px] text-neutral-500">Bearer token for generating checkouts from your backend server.</p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-neutral-300">
                    <span className="select-all">{client.apiKey}</span>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-neutral-900/60 pt-3 mt-3">
                  <div className="space-y-0.5">
                    <span className="text-neutral-300 font-semibold flex items-center gap-1">
                      APK Token (`detectToken`)
                    </span>
                    <p className="text-[10px] text-neutral-500">Configure inside your Android Notification listener APK.</p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-neutral-300">
                    <span className="select-all">{client.detectToken}</span>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-neutral-900/60 pt-3 mt-3">
                  <div className="space-y-0.5">
                    <span className="text-neutral-300 font-semibold flex items-center gap-1">
                      Webhook Secret (`webhookSecret`)
                    </span>
                    <p className="text-[10px] text-neutral-500">HMAC-SHA256 secret key for signing payloads forwarded to your server.</p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-neutral-300">
                    <span className="select-all">{client.webhookSecret || 'Not Generated'}</span>
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

            {/* Webhook Callback Settings */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-neutral-400" />
                <h2 className="text-base font-bold text-white">Webhook Callback Settings</h2>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-4">
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

          {/* Right Column: Downloads, Links, Recent Activity */}
          <div className="space-y-6">
            
            {/* APK Download & Demo */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">Listener Application</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
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
                  className="w-full border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded-xl h-10"
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
                          <span className="font-black text-emerald-400">+{tx.amountEgp.toFixed(2)} EGP</span>
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

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-900 py-6 bg-neutral-950 text-center text-xs text-neutral-600">
        InstaPay Egypt Platform Gateway Merchant Panel · Sandbox Environment
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
