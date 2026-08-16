'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Shield, ArrowRight, Loader2, LogIn, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.ok) {
        // Logged in successfully, redirect to dashboard
        router.push('/dashboard')
      } else {
        setErrorMessage(data.error || 'Invalid credentials or inactive account.')
      }
    } catch {
      setErrorMessage('Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
            <LogIn className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Merchant Dashboard Login</h1>
          <p className="text-sm text-neutral-400">
            Sign in to check stats, retrieve API keys, and configure webhooks.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              Password
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
                Signing In…
              </>
            ) : (
              <>
                Login to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-neutral-800/60">
          <p className="text-xs text-neutral-500">
            Don&apos;t have a merchant account?{' '}
            <a href="/register" className="text-violet-400 hover:underline">
              Sign Up
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
