'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Shield, ArrowRight, Zap, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClientDemo {
  id: string
  slug: string
  businessName: string
  instapayHandle: string
}

export default function LandingPage() {
  const [merchants, setMerchants] = useState<ClientDemo[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/merchants')
        if (res.ok) {
          const data = await res.json()
          if (data.ok) {
            setMerchants(data.merchants)
          }
        }
      } catch {}
      try {
        const res = await fetch('/api/plans')
        if (res.ok) {
          const data = await res.json()
          if (data.ok) {
            setPlans(data.plans)
          }
        }
      } catch {}
      setLoading(false)
    }
    loadData()
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-neutral-900 via-neutral-950 to-indigo-950 text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-emerald-400 shadow-md">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">InstaPay Gateway</h1>
                <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-400 border border-violet-500/30">
                  Multi-Tenant
                </span>
              </div>
              <p className="text-xs text-neutral-500">Egypt Instant Network Router</p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
          >
            <a href="/login">
              <LayoutDashboard className="mr-1.5 h-4 w-4" />
              Merchant Portal
            </a>
          </Button>
        </div>
      </header>

      {/* Main hero */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 sm:px-6 flex flex-col justify-center space-y-10">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400 border border-violet-500/25"
          >
            <Zap className="h-3 w-3 fill-violet-400" />
            Platform Gateway Live
          </motion.div>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Multi-Tenant InstaPay confirmation system
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
            Integrate InstaPay auto-confirmation on any business project. Clients run the companion notification detector APK on their devices to capture customer transactions automatically.
          </p>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Admin panel promo */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block">Developer Integration</span>
              <h3 className="text-lg font-bold text-white">Get Started in Minutes</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Register your business account today to receive custom API integration keys, APK tokens, and sandbox callback credentials. Accounts activate instantly upon admin approval.
              </p>
            </div>
            <Button asChild className="w-full bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl">
              <a href="/register">
                Register Merchant Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          {/* Client select / Demo */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2 flex-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Merchant Checkout Demo</span>
              <h3 className="text-lg font-bold text-white">Hosted Checkout Pages</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Choose an active client merchant to test their specific payment flow. Customers visit these pages to generate deep links and QR codes.
              </p>
              
              {/* Merchants Selector */}
              {loading ? (
                <div className="h-20 animate-pulse bg-neutral-950 rounded-xl mt-4" />
              ) : merchants.length === 0 ? (
                <div className="text-xs text-neutral-500 italic mt-3 bg-neutral-950 p-3 rounded-xl border border-neutral-900">
                  No active clients found. Please go to the Admin portal first and add a client account.
                </div>
              ) : (
                <div className="space-y-1.5 mt-3 max-h-32 overflow-y-auto pr-1">
                  {merchants.map((m) => (
                    <a
                      key={m.id}
                      href={`/pay/${m.slug}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 transition-all text-xs"
                    >
                      <span className="font-semibold text-neutral-300">{m.businessName}</span>
                      <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
                        pay/{m.slug} <ExternalLink className="h-3 w-3" />
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Tiers Section */}
        {plans.length > 0 && (
          <div className="space-y-6 pt-10 border-t border-neutral-800/40">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight font-sans">Simple, Transaction-Based Pricing</h3>
              <p className="text-xs text-neutral-400">Choose a quota plan that matches your transaction volume requirements.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between space-y-5 transition-all ${
                    p.name === 'PRO'
                      ? 'border-violet-500 bg-violet-950/10 shadow-lg shadow-violet-950/10'
                      : 'border-neutral-800/80 bg-neutral-900/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                        {p.name.replace('_', ' ')}
                      </span>
                      {p.name === 'PRO' && (
                        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold text-violet-400 border border-violet-500/30">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">{p.priceEgp} EGP</span>
                      <span className="text-[10px] text-neutral-500">/one-time</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed pt-1">
                      Allows processing up to <span className="font-bold text-white">{p.maxTransactions.toLocaleString()}</span> confirmed transactions.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className={`w-full rounded-xl text-xs font-semibold ${
                      p.name === 'PRO'
                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                    }`}
                  >
                    <a href="/register">Get Started</a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 mt-12 bg-neutral-950/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-neutral-500">
          InstaPay Platform Gateway · Sandbox Environment for testing
        </div>
      </footer>
    </div>
  )
}
