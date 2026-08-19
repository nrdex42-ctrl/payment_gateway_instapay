'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  XCircle,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface CheckoutStatus {
  sessionId: string
  senderHandle: string
  recipientHandle: string
  merchantName?: string
  amountEgp: number
  currency: string
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'UNDERPAID'
  note?: string | null
  deepLinkUrl?: string
  deepLinkToken?: string
  qrCodeDataUrl?: string
  detectedRef?: string | null
  detectedAt?: string | null
  detectedAmountEgp?: number | null
  createdAt: string
  expiresAt: string
  secondsRemaining: number
}

interface Props {
  checkout: CheckoutStatus
  onReset: () => void
}

const POLL_INTERVAL_MS = 3000 // Polling fallback in case WebSocket fails

export function WaitingScreen({ checkout, onReset }: Props) {
  const [current, setCurrent] = useState(checkout)
  const [copied, setCopied] = useState<'handle' | 'link' | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // --- WebSocket: primary real-time channel ---
  useEffect(() => {
    if (current.status !== 'PENDING') return

    // Connect to the checkout-notifier service.
    // - Local dev (sandbox): uses relative path "/" with XTransformPort=3003
    //   so Caddy forwards to the mini-service on port 3003.
    // - Production (Render/etc): uses NEXT_PUBLIC_NOTIFIER_URL env var
    //   pointing to the deployed notifier service URL.
    const notifierUrl = process.env.NEXT_PUBLIC_NOTIFIER_URL
    const socket: Socket = io(
      notifierUrl ? notifierUrl : '/?XTransformPort=3003',
      {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 5000,
      }
    )

    socket.on('connect', () => {
      setWsConnected(true)
      socket.emit('join', { sessionId: current.sessionId })
    })

    socket.on('disconnect', () => {
      setWsConnected(false)
    })

    socket.on('checkout:update', (payload: Partial<CheckoutStatus>) => {
      if (payload.sessionId !== current.sessionId) return
      setCurrent((prev) => ({
        ...prev,
        ...payload,
      }) as CheckoutStatus)
    })

    return () => {
      socket.disconnect()
    }
  }, [current.status, current.sessionId])

  // --- Polling fallback: still checks every 3s in case the WebSocket
  //     drops or the mini-service is down. ---
  useEffect(() => {
    if (current.status !== 'PENDING') return
    let cancelled = false

    async function poll() {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        if (cancelled) return
        try {
          const res = await fetch(`/api/checkout/${current.sessionId}`, {
            cache: 'no-store',
          })
          if (res.ok) {
            const data = await res.json()
            if (data.ok && data.checkout) {
              // Merge instead of replace — the polling endpoint (GET) doesn't
              // return qrCodeDataUrl or merchantName (they're only in the
              // POST response). Preserve them from the existing state so
              // the QR code + deep link section doesn't disappear on poll.
              setCurrent((prev) => ({
                ...prev,
                ...data.checkout,
                qrCodeDataUrl: prev.qrCodeDataUrl,
                merchantName: prev.merchantName,
              }) as CheckoutStatus)
              if (data.checkout.status !== 'PENDING') return
            }
          }
        } catch {
          // ignore transient errors — keep polling
        }
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [current.status, current.sessionId])

  const copy = async (text: string, kind: 'handle' | 'link') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  if (current.status === 'CONFIRMED') {
    return <ConfirmedView checkout={current} onReset={onReset} />
  }

  if (current.status === 'EXPIRED') {
    return <ExpiredView checkout={current} onReset={onReset} />
  }

  if (current.status === 'UNDERPAID') {
    return <UnderpaidView checkout={current} onReset={onReset} />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Waiting for your payment</h2>
          <p className="text-sm text-neutral-500">
            Scan the QR or open the link, then complete the transfer in InstaPay.
          </p>
        </div>
      </div>

      {/* QR code + deep link */}
      {current.qrCodeDataUrl && current.deepLinkUrl && (
        <div className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-neutral-50 to-white p-5">
          <div className="flex flex-col items-center gap-4">
            {/* QR */}
            <div className="relative rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-100">
              <img
                src={current.qrCodeDataUrl}
                alt="InstaPay deep link QR code"
                className="h-44 w-44"
              />
              {/* Center logo overlay */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-gradient-to-br from-violet-600 via-fuchsia-500 to-emerald-400 shadow-md ring-2 ring-white">
                <span className="text-[8px] font-black tracking-tight text-white">IPN</span>
              </div>
            </div>

            {/* Handle + powered-by */}
            <div className="text-center">
              <p className="break-all font-mono text-sm font-bold text-neutral-900">
                {current.recipientHandle}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">Powered by InstaPay</p>
            </div>

            {/* Deep link button */}
            <a
              href={current.deepLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:from-violet-700 hover:to-fuchsia-700 hover:shadow-violet-600/30"
            >
              <ExternalLink className="h-4 w-4" />
              Open in InstaPay app
            </a>

            <button
              type="button"
              onClick={() => copy(current.deepLinkUrl!, 'link')}
              className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              <Copy className="h-3 w-3" />
              {copied === 'link' ? 'Link copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {/* Or: manual send instructions */}
      <div className="rounded-xl border border-neutral-100 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Or send manually
        </p>
        <ol className="space-y-3">
          <InstructionStep
            num={1}
            title="Open the InstaPay app"
            body="Launch InstaPay on your Android/iOS device."
          />
          <InstructionStep
            num={2}
            title="Send a new payment"
            body={`Transfer exactly ${current.amountEgp.toFixed(2)} ${current.currency} to the merchant handle below.`}
          />
          <InstructionStep
            num={3}
            title="Use your exact InstaPay username"
            body={`Send from "${current.senderHandle}" — if it doesn't match, we can't detect the payment.`}
            warning
          />
          <InstructionStep
            num={4}
            title="We'll detect it automatically"
            body="Once the merchant's phone receives the InstaPay notification, this page updates by itself."
          />
        </ol>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              Send to
            </span>
            <p className="break-all font-mono text-sm font-semibold text-neutral-900">
              {current.recipientHandle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => copy(current.recipientHandle, 'handle')}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            <Copy className="h-3 w-3" />
            {copied === 'handle' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Timer + connection status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
          <Clock className="h-4 w-4" />
          <span>
            Expires in{' '}
            <span className="font-bold tabular-nums">
              {formatCountdown(current.secondsRemaining)}
            </span>
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-medium"
          title={
            wsConnected
              ? 'Real-time WebSocket connection active'
              : 'Using polling fallback (checking every 3s)'
          }
          style={{
            backgroundColor: wsConnected ? '#ECFDF5' : '#FFFBEB',
            color: wsConnected ? '#047857' : '#92400E',
          }}
        >
          {wsConnected ? <Zap className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
          {wsConnected ? 'Live' : 'Polling'}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onReset}
        className="w-full text-neutral-500 hover:text-neutral-700"
      >
        Cancel and start over
      </Button>
    </motion.div>
  )
}

function InstructionStep({
  num,
  title,
  body,
  warning,
}: {
  num: number
  title: string
  body: string
  warning?: boolean
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          warning ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'
        }`}
      >
        {num}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="text-sm text-neutral-600">{body}</p>
      </div>
    </li>
  )
}

function ConfirmedView({
  checkout,
  onReset,
}: {
  checkout: CheckoutStatus
  onReset: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-5 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100"
      >
        <CheckCircle2 className="h-12 w-12" />
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Payment confirmed!</h2>
        <p className="mt-1 text-sm text-neutral-600">
          We detected your InstaPay transfer automatically.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left">
        <Row label="From" value={checkout.senderHandle} mono />
        <Row label="To" value={checkout.recipientHandle} mono />
        <Row
          label="Amount"
          value={`${checkout.amountEgp.toFixed(2)} ${checkout.currency}`}
          bold
        />
        {checkout.detectedRef && (
          <Row label="Reference" value={checkout.detectedRef} mono />
        )}
        {checkout.detectedAt && (
          <Row
            label="Detected at"
            value={new Date(checkout.detectedAt).toLocaleString()}
          />
        )}
        {checkout.note && <Row label="Note" value={checkout.note} />}
      </div>

      <Button
        type="button"
        onClick={onReset}
        className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-[15px] font-semibold text-white shadow-lg"
      >
        <Smartphone className="mr-2 h-4 w-4" />
        Make another payment
      </Button>
    </motion.div>
  )
}

function ExpiredView({
  checkout,
  onReset,
}: {
  checkout: CheckoutStatus
  onReset: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-5 text-center"
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600 ring-4 ring-red-100">
        <XCircle className="h-12 w-12" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Request expired</h2>
        <p className="mt-1 text-sm text-neutral-600">
          We didn&apos;t detect a matching InstaPay transfer within the time limit.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left">
        <Row label="From" value={checkout.senderHandle} mono />
        <Row
          label="Amount"
          value={`${checkout.amountEgp.toFixed(2)} ${checkout.currency}`}
          bold
        />
        <Row label="Expired at" value={new Date(checkout.expiresAt).toLocaleString()} />
      </div>

      <div className="rounded-lg bg-amber-50 px-4 py-3 text-left text-xs text-amber-800">
        <p className="font-semibold">Why didn&apos;t it match?</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>You didn&apos;t complete the transfer in time.</li>
          <li>The InstaPay username you typed didn&apos;t match the one you sent from.</li>
          <li>The amount didn&apos;t match exactly.</li>
          <li>The merchant&apos;s detector app wasn&apos;t running.</li>
        </ul>
      </div>

      <Button
        type="button"
        onClick={onReset}
        className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-[15px] font-semibold text-white shadow-lg"
      >
        Try again
      </Button>
    </motion.div>
  )
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string
  value: string
  mono?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span
        className={`break-all text-right text-sm text-neutral-900 ${mono ? 'font-mono' : ''} ${
          bold ? 'font-bold' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function UnderpaidView({
  checkout,
  onReset,
}: {
  checkout: CheckoutStatus
  onReset: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-5 text-center"
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-4 ring-amber-100">
        <XCircle className="h-12 w-12 text-amber-500" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-neutral-900 font-sans">Underpayment Detected</h2>
        <p className="mt-1 text-sm text-neutral-600">
          You transferred less than the requested amount. Please contact the merchant to resolve this.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left">
        <Row label="Requested" value={`${checkout.amountEgp.toFixed(2)} ${checkout.currency}`} bold />
        <Row
          label="Received"
          value={`${checkout.detectedAmountEgp?.toFixed(2) || '0.00'} ${checkout.currency}`}
          bold
          mono
        />
        <Row label="Sender" value={checkout.senderHandle} mono />
        {checkout.detectedRef && <Row label="Reference" value={checkout.detectedRef} mono />}
      </div>

      <Button
        type="button"
        onClick={onReset}
        className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-[15px] font-semibold text-white shadow-lg"
      >
        Try again
      </Button>
    </motion.div>
  )
}
