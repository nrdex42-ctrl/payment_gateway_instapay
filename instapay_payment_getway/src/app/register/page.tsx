'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, ArrowRight, Loader2, Sparkles, CheckCircle2, UserPlus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const [businessName, setBusinessName] = useState('')
  const [instapayHandle, setInstapayHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, instapayHandle, email, password }),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
      } else {
        setErrorMessage(data.error || 'Failed to complete registration.')
      }
    } catch {
      setErrorMessage('Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Live preview of the normalized handle
  const normalizedPreview = (() => {
    const raw = instapayHandle.trim()
    if (!raw) return ''
    const lower = raw.toLowerCase().replace(/^@/, '')
    const local = lower.split('@')[0]
    return local ? `${local}@instapay` : ''
  })()

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-indigo-950 p-4 font-sans text-neutral-100">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl text-center space-y-6"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mx-auto border border-emerald-500/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Registration Submitted!</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Your merchant account is now **pending admin review**. The platform owner will check your details. Once approved, you will receive full access to your keys and dashboard.
            </p>
          </div>
          <Button
            asChild
            className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white shadow-lg shadow-violet-600/20 hover:from-violet-700 hover:to-indigo-700"
          >
            <a href="/login">Go to Login</a>
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-indigo-950 p-4 font-sans text-neutral-100">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-indigo-400 shadow-md">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Create Merchant Account</h1>
          <p className="text-sm text-neutral-400">
            Sign up to integrate the InstaPay gateway on your business projects.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="businessName" className="text-xs text-neutral-300">
              Business / Developer Name
            </Label>
            <Input
              id="businessName"
              type="text"
              placeholder="e.g. Ahmed Electronics"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instapayHandle" className="text-xs text-neutral-300">
              InstaPay Handle (For receiving funds)
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">
                @
              </span>
              <Input
                id="instapayHandle"
                type="text"
                placeholder="e.g. storename"
                value={instapayHandle}
                onChange={(e) => setInstapayHandle(e.target.value)}
                className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 pl-7 focus-visible:ring-violet-500"
                required
                disabled={submitting}
              />
            </div>
            {normalizedPreview && (
              <p className="text-[10px] text-neutral-500 mt-1">
                Your checkout deep links will direct payments to:{' '}
                <span className="font-semibold text-neutral-400">{normalizedPreview}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-neutral-300">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. info@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-neutral-300">
              Password (Min 8 chars, letters & numbers)
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-xl border-neutral-800 bg-neutral-950 text-white placeholder-neutral-700 focus-visible:ring-violet-500"
              required
              disabled={submitting}
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering Account…
              </>
            ) : (
              <>
                Register Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-neutral-800/60">
          <p className="text-xs text-neutral-500">
            Already have an account?{' '}
            <a href="/login" className="text-violet-400 hover:underline">
              Log In
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
