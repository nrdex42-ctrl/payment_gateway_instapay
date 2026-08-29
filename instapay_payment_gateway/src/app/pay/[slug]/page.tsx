'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, Smartphone, Zap } from 'lucide-react'
import { CheckoutForm, type CheckoutFormValues } from '@/components/checkout-form'
import { WaitingScreen, type CheckoutStatus } from '@/components/waiting-screen'

interface ClientDetails {
  id: string
  slug: string
  businessName: string
  instapayHandle: string
}

interface ApiResponse {
  ok: boolean
  error?: string
  client?: ClientDetails
  checkout?: CheckoutStatus
}

export default function HostedCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [client, setClient] = useState<ClientDetails | null>(null)
  const [loadingClient, setLoadingClient] = useState(true)
  const [clientError, setClientError] = useState<string | null>(null)

  // Checkout states
  const [step, setStep] = useState<'form' | 'waiting'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<CheckoutStatus | null>(null)

  useEffect(() => {
    async function loadClient() {
      try {
        const response = await fetch(`/api/checkout?slug=${slug}`)
        if (response.ok) {
          const data = await response.json()
          if (data.ok) {
            setClient(data.client)
          } else {
            setClientError(data.error || 'Merchant not found')
          }
        } else {
          setClientError('Failed to fetch merchant details.')
        }
      } catch {
        setClientError('Network error loading merchant details.')
      } finally {
        setLoadingClient(false)
      }
    }
    loadClient()
  }, [slug])

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
          clientSlug: slug,
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

  if (loadingClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent mx-auto" />
          <p className="text-sm text-neutral-500 font-medium">Loading checkout details…</p>
        </div>
      </div>
    )
  }

  if (clientError || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-md space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-neutral-900">Checkout Error</h2>
            <p className="text-sm text-neutral-500">{clientError || 'Merchant is inactive or does not exist.'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-neutral-50 via-white to-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-md ring-1 ring-neutral-100">
              <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-neutral-900">{client.businessName}</h1>
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                  Secured
                </span>
              </div>
              <p className="text-xs text-neutral-500">Payment Gateway</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Pay via the InstaPay app</span>
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
                    actual transfer inside the InstaPay app. We will automatically detect and confirm it.
                  </p>
                </div>
              </div>

              <CheckoutForm
                submitting={submitting}
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                recipientHandle={client.instapayHandle}
              />
            </div>
          )}

          {step === 'waiting' && checkout && (
            <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-6">
              <WaitingScreen checkout={checkout} onReset={handleReset} />
            </div>
          )}

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <div className="text-xs leading-relaxed text-neutral-600">
              <span className="font-semibold text-neutral-800">Payment notification listener.</span> This gateway does not move money directly. You complete the transfer inside the official InstaPay app to <span className="font-mono font-semibold">{client.instapayHandle}</span>. The merchant&apos;s phone APK detects this notification and confirms the order instantly.
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-neutral-400 sm:flex-row">
            <p>
              InstaPay Egypt · Multi-Tenant Payment Gateway Platform
            </p>
            <p>Pay with the official InstaPay app · Auto-detected via notifications</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
