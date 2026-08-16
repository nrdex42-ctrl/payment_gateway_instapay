'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, ShieldAlert, Smartphone, Zap } from 'lucide-react'
import { CheckoutForm, type CheckoutFormValues } from '@/components/checkout-form'
import { MerchantDashboard } from '@/components/merchant-dashboard'
import { WaitingScreen, type CheckoutStatus } from '@/components/waiting-screen'
import { cn } from '@/lib/utils'

type Tab = 'client' | 'dashboard'
type Step = 'form' | 'waiting'

interface ApiResponse {
  ok: boolean
  error?: string
  checkout?: CheckoutStatus
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('client')

  // Client checkout state
  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<CheckoutStatus | null>(null)

  const handleSubmit = async (values: CheckoutFormValues) => {
    setErrorMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderHandle: values.senderHandle,
          amountEgp: parseFloat(values.amountEgp),
          note: values.note,
        }),
      })
      const data: ApiResponse = await res.json()
      if (!data.ok || !data.checkout) {
        setErrorMessage(data.error || 'Failed to generate payment request.')
        return
      }
      setCheckout(data.checkout)
      setStep('waiting')
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setCheckout(null)
    setErrorMessage(null)
    setStep('form')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-neutral-50 via-white to-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-emerald-400 shadow-md">
              <span className="text-xs font-black tracking-tight text-white">IPN</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-neutral-900">InstaPay</h1>
                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                  Detector
                </span>
              </div>
              <p className="text-xs text-neutral-500">Egypt Instant Payment Network</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Pay via the InstaPay app</span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1">
            <TabButton
              active={tab === 'client'}
              onClick={() => setTab('client')}
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Pay"
            />
            <TabButton
              active={tab === 'dashboard'}
              onClick={() => setTab('dashboard')}
              icon={<LayoutDashboard className="h-3.5 w-3.5" />}
              label="Dashboard"
            />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {tab === 'client' && (
            <>
              {step === 'form' && (
                <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-neutral-900">Start a payment</h2>
                      <p className="text-sm text-neutral-500">
                        Enter your InstaPay username and the amount. You&apos;ll complete the
                        actual transfer inside the InstaPay app — we&apos;ll detect it
                        automatically.
                      </p>
                    </div>
                  </div>

                  <CheckoutForm
                    submitting={submitting}
                    onSubmit={handleSubmit}
                    errorMessage={errorMessage}
                  />
                </div>
              )}

              {step === 'waiting' && checkout && (
                <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-6">
                  <WaitingScreen checkout={checkout} onReset={handleReset} />
                </div>
              )}

              <DisclaimerBanner />
            </>
          )}

          {tab === 'dashboard' && (
            <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-6">
              <MerchantDashboard />
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-neutral-500 sm:flex-row">
            <p>
              InstaPay Egypt · Detector Payment Gateway · Sandbox for testing purposes
              only.
            </p>
            <p>Pay with the official InstaPay app · Auto-detected via notifications</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-violet-600 text-violet-700'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function DisclaimerBanner() {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="text-xs leading-relaxed text-amber-800">
        <span className="font-semibold">How it works.</span> This gateway does not move
        money. You complete the actual transfer inside the official InstaPay app. A
        companion Android app on the merchant&apos;s device reads InstaPay&apos;s
        &ldquo;received&rdquo; notifications and reports them to this gateway so your
        payment can be auto-confirmed.
      </div>
    </div>
  )
}
