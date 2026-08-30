'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const onboardingSteps = [
  'Create your merchant account',
  'Admin reviews and approves your business',
  'Complete payment link and webhook setup in the dashboard',
  'Start creating checkout sessions from your backend',
]

const SYSTEM_EMAIL = 'instapay.payment.gateway@gmail.com'

const trustPoints = [
  'No payment credentials are collected during signup',
  'API keys are issued after account approval',
  'Webhook and InstaPay receiving details are configured inside the dashboard',
]

function passwordScore(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/i.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  return score
}

export default function RegisterPage() {
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const score = useMemo(() => passwordScore(password), [password])

  const sendOtp = async () => {
    setErrorMessage(null)
    setSendingOtp(true)
    try {
      const res = await fetch('/api/auth/email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.ok) {
        setVerificationId(data.verificationId)
        setOtpSent(true)
      } else {
        setErrorMessage(data.error || 'Failed to send verification code.')
      }
    } catch {
      setErrorMessage('Connection error. Please try again.')
    } finally {
      setSendingOtp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, businessType, email, password, verificationId, otp }),
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

  if (success) {
    return (
      <div className="min-h-screen bg-[#070a12] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12 sm:px-6">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="mt-6 text-2xl font-black tracking-tight">Application submitted</h1>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Your merchant account is pending review. After approval, sign in to the dashboard to
              add your InstaPay receiving handle, static payment link, webhook endpoint, and API integration settings.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              For approval questions or account support, contact{' '}
              <a href={`mailto:${SYSTEM_EMAIL}`} className="font-semibold text-indigo-300 hover:text-indigo-200">
                {SYSTEM_EMAIL}
              </a>
              .
            </p>

            <div className="mt-7 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">What happens next</div>
              <div className="mt-4 space-y-3">
                {onboardingSteps.slice(1).map((step, index) => (
                  <div key={step} className="flex gap-3 text-sm text-slate-300">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button asChild className="mt-7 h-11 w-full rounded-2xl bg-white text-slate-950 hover:bg-slate-200">
              <a href="/login">Go to sign in</a>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      <header className="border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5">
              <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight">InstaPay Gateway</div>
              <div className="hidden text-xs text-slate-400 sm:block">Merchant onboarding</div>
            </div>
          </a>

          <div className="flex shrink-0 items-center gap-3">
            <div data-language-toggle-slot data-i18n-skip />
            <a href={`mailto:${SYSTEM_EMAIL}`} className="hidden text-xs font-semibold text-slate-400 hover:text-slate-200 sm:inline">
              {SYSTEM_EMAIL}
            </a>
            <Button asChild variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10 hover:text-white">
              <a href="/login">Sign in</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:px-8 lg:py-20">
        <section className="flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            Start with only the required account details
          </div>

          <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-6xl">
            Create your merchant account.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
            Apply for access to the InstaPay payment gateway. After approval, the dashboard guides you
            through payment receiving details, webhook setup, API keys, and billing.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Merchant support:{' '}
            <a href={`mailto:${SYSTEM_EMAIL}`} className="font-semibold text-indigo-300 hover:text-indigo-200">
              {SYSTEM_EMAIL}
            </a>
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {trustPoints.map((point) => (
              <div key={point} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{point}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Onboarding flow</div>
            <div className="mt-5 grid gap-3">
              {onboardingSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/30 backdrop-blur sm:p-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-4 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                  <UserPlus className="h-4 w-4" />
                  Merchant application
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Sign up</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Verify your email before submitting.
                </p>
              </div>
              <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-200 ring-1 ring-indigo-400/20">
                <LockKeyhole className="h-5 w-5" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-xs font-semibold text-slate-300">
                  Business name
                </Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="Example Store"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType" className="text-xs font-semibold text-slate-300">
                  Business type
                </Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <select
                    id="businessType"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#0b1020] pl-10 pr-4 text-sm text-white outline-none ring-offset-background transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
                    required
                    disabled={submitting}
                  >
                    <option value="">Select business type</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Retail store">Retail store</option>
                    <option value="Digital services">Digital services</option>
                    <option value="Food and beverage">Food and beverage</option>
                    <option value="Education">Education</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Freelancer">Freelancer</option>
                    <option value="Nonprofit">Nonprofit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <p className="text-xs text-slate-500">
                  This helps the admin review your account and tune your gateway setup.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                  Work email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="owner@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setOtpSent(false)
                      setVerificationId('')
                      setOtp('')
                    }}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
                    required
                    disabled={submitting}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Temporary email providers are blocked. Use Gmail or a real business inbox.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.04] px-10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 rounded-full ${score >= level ? 'bg-emerald-400' : 'bg-white/10'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500">Use at least 8 characters with letters and numbers.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="otp" className="text-xs font-semibold text-slate-300">
                      Email verification code
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-center font-mono text-lg tracking-[0.35em] text-white placeholder:text-slate-700 focus-visible:ring-indigo-500"
                      required
                      disabled={submitting || !otpSent}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendOtp}
                    disabled={sendingOtp || submitting || !email}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.04] px-5 text-white hover:bg-white/10"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending
                      </>
                    ) : otpSent ? 'Resend code' : 'Send code'}
                  </Button>
                </div>
                {otpSent && (
                  <p className="mt-3 text-xs leading-6 text-emerald-300">
                    We sent a 6-digit code to {email}. It expires in 10 minutes.
                  </p>
                )}
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !otpSent || otp.length !== 6}
                className="h-12 w-full rounded-2xl bg-indigo-500 font-bold text-white hover:bg-indigo-400 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying and submitting
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-6 text-slate-500">
              By creating an account, you confirm this is a business payment integration request.
              Already approved? <a href="/login" className="font-semibold text-indigo-300 hover:text-indigo-200">Sign in</a>.
              <br />
              Need help? <a href={`mailto:${SYSTEM_EMAIL}`} className="font-semibold text-indigo-300 hover:text-indigo-200">{SYSTEM_EMAIL}</a>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
