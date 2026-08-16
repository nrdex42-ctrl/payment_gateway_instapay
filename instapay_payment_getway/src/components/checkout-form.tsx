'use client'

import { useState } from 'react'
import { AlertCircle, ArrowRight, Loader2, Smartphone } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface CheckoutFormValues {
  senderHandle: string
  amountEgp: string
  note: string
}

interface Props {
  submitting: boolean
  errorMessage?: string | null
  onSubmit: (values: CheckoutFormValues) => void
  recipientHandle?: string
}

const QUICK_AMOUNTS = [25, 50, 100, 250, 500, 1000]

export function CheckoutForm({ submitting, errorMessage, onSubmit, recipientHandle = 'mohammedshabana77@instapay' }: Props) {
  const [values, setValues] = useState<CheckoutFormValues>({
    senderHandle: '',
    amountEgp: '',
    note: '',
  })

  const update = <K extends keyof CheckoutFormValues>(key: K, val: CheckoutFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  // Live preview of the normalized handle the user is typing.
  const normalizedPreview = (() => {
    const raw = values.senderHandle.trim()
    if (!raw) return ''
    const lower = raw.toLowerCase().replace(/^@/, '')
    const local = lower.split('@')[0]
    return local ? `${local}@instapay` : ''
  })()

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Client's InstaPay username */}
      <div className="space-y-2">
        <Label htmlFor="senderHandle" className="text-sm font-medium text-neutral-700">
          Your InstaPay username
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            @
          </span>
          <Input
            id="senderHandle"
            type="text"
            inputMode="email"
            autoComplete="off"
            placeholder="e.g. ahmed_saleh123"
            value={values.senderHandle}
            onChange={(e) => update('senderHandle', e.target.value)}
            className="h-11 rounded-xl border-neutral-200 bg-white pl-7 text-[15px] shadow-sm focus-visible:ring-violet-500"
            required
            disabled={submitting}
          />
        </div>
        {normalizedPreview && (
          <p className="text-xs text-neutral-500">
            We&apos;ll detect the payment from{' '}
            <span className="font-semibold text-neutral-700">{normalizedPreview}</span>
          </p>
        )}
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Type this <span className="font-semibold">exactly</span> as it appears in your
            InstaPay app. If it doesn&apos;t match, we won&apos;t be able to detect your
            payment.
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amountEgp" className="text-sm font-medium text-neutral-700">
          Amount to send (EGP)
        </Label>
        <div className="relative">
          <Input
            id="amountEgp"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amountEgp}
            onChange={(e) => update('amountEgp', e.target.value)}
            className="h-12 rounded-xl border-neutral-200 bg-white pr-14 text-lg font-semibold text-neutral-900 shadow-sm focus-visible:ring-violet-500"
            required
            disabled={submitting}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">
            EGP
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => update('amountEgp', amt.toFixed(2))}
              disabled={submitting}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                values.amountEgp === amt.toFixed(2)
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-violet-300 hover:bg-violet-50/50'
              )}
            >
              {amt} EGP
            </button>
          ))}
        </div>
      </div>

      {/* Optional note */}
      <div className="space-y-2">
        <Label htmlFor="note" className="text-sm font-medium text-neutral-700">
          Note <span className="font-normal text-neutral-400">(optional)</span>
        </Label>
        <Textarea
          id="note"
          rows={2}
          placeholder="Order ID, reference, or message"
          value={values.note}
          onChange={(e) => update('note', e.target.value)}
          className="resize-none rounded-xl border-neutral-200 bg-white text-[15px] shadow-sm focus-visible:ring-violet-500"
          disabled={submitting}
        />
      </div>

      {/* Recipient info card */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            You&apos;ll send to
          </span>
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            Merchant
          </span>
        </div>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-neutral-900">
          {recipientHandle}
        </p>
      </div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </motion.div>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-[15px] font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:from-violet-700 hover:to-fuchsia-700 hover:shadow-violet-600/30 disabled:opacity-70"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating payment request…
          </>
        ) : (
          <>
            <Smartphone className="mr-2 h-4 w-4" />
            Generate payment request
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  )
}
