'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SYSTEM_EMAIL = 'instapay.payment.gateway@gmail.com'

function passwordScore(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/i.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  return score
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [loginCodeSent, setLoginCodeSent] = useState(false)
  const [resetCodeSent, setResetCodeSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const score = useMemo(() => passwordScore(newPassword), [newPassword])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, verificationId, otp }),
      })
      const data = await res.json()
      if (data.ok && data.otpRequired) {
        setVerificationId(data.verificationId || '')
        setLoginCodeSent(Boolean(data.verificationId))
        setOtp('')
        setSuccessMessage(data.message || 'Login verification code sent.')
      } else if (data.ok) {
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

  const requestResetCode = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.ok) {
        setVerificationId(data.verificationId || '')
        setResetCodeSent(Boolean(data.verificationId))
        setSuccessMessage(data.message || 'If the account exists, a reset code has been sent.')
      } else {
        setErrorMessage(data.error || 'Failed to send reset code.')
      }
    } catch {
      setErrorMessage('Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, verificationId, otp, password: newPassword }),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccessMessage('Password updated. You can now sign in.')
        setPassword('')
        setNewPassword('')
        setOtp('')
        setVerificationId('')
        setResetCodeSent(false)
        setLoginCodeSent(false)
        setMode('login')
      } else {
        setErrorMessage(data.error || 'Failed to reset password.')
      }
    } catch {
      setErrorMessage('Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (nextMode: 'login' | 'reset') => {
    setMode(nextMode)
    setErrorMessage(null)
    setSuccessMessage(null)
    setOtp('')
    setVerificationId('')
    setResetCodeSent(false)
    setLoginCodeSent(false)
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
              <div className="hidden text-xs text-slate-400 sm:block">Merchant console</div>
            </div>
          </a>

          <div className="flex shrink-0 items-center gap-3">
            <div data-language-toggle-slot data-i18n-skip />
            <a href={`mailto:${SYSTEM_EMAIL}`} className="hidden text-xs font-semibold text-slate-400 hover:text-slate-200 sm:inline">
              {SYSTEM_EMAIL}
            </a>
            <Button asChild variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10 hover:text-white">
              <a href="/register">Create account</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:px-8 lg:py-20">
        <section className="flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            <LockKeyhole className="h-3.5 w-3.5" />
            Secure merchant access
          </div>

          <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-6xl">
            Sign in to manage your payment gateway.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
            Access transactions, webhook delivery, API credentials, subscription billing, and receiving account configuration from one dashboard.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Merchant support:{' '}
            <a href={`mailto:${SYSTEM_EMAIL}`} className="font-semibold text-indigo-300 hover:text-indigo-200">
              {SYSTEM_EMAIL}
            </a>
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: <BarChart3 className="h-4 w-4" />, text: 'Payment analytics' },
              { icon: <Terminal className="h-4 w-4" />, text: 'API credentials' },
              { icon: <KeyRound className="h-4 w-4" />, text: 'Webhook security' },
            ].map((item) => (
              <div key={item.text} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <span className="text-cyan-200">{item.icon}</span>
                  {item.text}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account security</div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
              <div className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Password reset uses a time-limited email verification code.
              </div>
              <div className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Access is only granted after admin approval and account activation.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/30 backdrop-blur sm:p-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-4 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                  <ShieldCheck className="h-4 w-4" />
                  {mode === 'login' ? 'Merchant login' : 'Password recovery'}
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  {mode === 'login' ? 'Welcome back' : 'Reset password'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {mode === 'login'
                    ? loginCodeSent
                      ? 'Enter the 6-digit code sent to your merchant email.'
                      : 'Use your approved merchant credentials. A verification code is required before access.'
                    : 'Receive a 6-digit code by email and set a new password.'}
                </p>
              </div>
              <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-200 ring-1 ring-indigo-400/20">
                <LockKeyhole className="h-5 w-5" />
              </div>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="mt-7 space-y-5">
                <EmailField email={email} setEmail={setEmail} disabled={submitting || loginCodeSent} />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Label htmlFor="password" className="text-xs font-semibold text-slate-300">Password</Label>
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    setShow={setShowPassword}
                    disabled={submitting || loginCodeSent}
                    placeholder="Your password"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginOtp" className="text-xs font-semibold text-slate-300">
                      Login verification code
                    </Label>
                    <Input
                      id="loginOtp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-center font-mono text-lg tracking-[0.35em] text-white placeholder:text-slate-700 focus-visible:ring-indigo-500"
                      required={loginCodeSent}
                      disabled={submitting || !loginCodeSent}
                    />
                    <p className="text-xs leading-5 text-slate-500">
                      {loginCodeSent ? 'The code expires in 10 minutes. Use the link below to resend a new code.' : 'Request the code first, then paste it here.'}
                    </p>
                  </div>
                </div>

                <StatusMessages error={errorMessage} success={successMessage} />

                <Button
                  type="submit"
                  disabled={submitting || (loginCodeSent && otp.length !== 6)}
                  className="h-12 w-full rounded-2xl bg-indigo-500 font-bold text-white hover:bg-indigo-400 disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loginCodeSent ? 'Verifying' : 'Sending code'}</>
                  ) : loginCodeSent ? (
                    <>Verify and sign in<ArrowRight className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>Continue<ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>

                {loginCodeSent && (
                  <button
                    type="button"
                    onClick={() => {
                      setLoginCodeSent(false)
                      setVerificationId('')
                      setOtp('')
                      setErrorMessage(null)
                      setSuccessMessage(null)
                    }}
                    className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Change credentials or resend code
                  </button>
                )}
              </form>
            ) : (
              <form onSubmit={confirmPasswordReset} className="mt-7 space-y-5">
                <EmailField email={email} setEmail={setEmail} disabled={submitting || resetCodeSent} />

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="resetOtp" className="text-xs font-semibold text-slate-300">
                        Reset code
                      </Label>
                      <Input
                        id="resetOtp"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-center font-mono text-lg tracking-[0.35em] text-white placeholder:text-slate-700 focus-visible:ring-indigo-500"
                        required
                        disabled={submitting || !resetCodeSent}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={requestResetCode}
                      disabled={submitting || !email}
                      className="h-12 rounded-2xl border-white/10 bg-white/[0.04] px-5 text-white hover:bg-white/10"
                    >
                      {submitting && !resetCodeSent ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending</> : resetCodeSent ? 'Resend code' : 'Send code'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-300">New password</Label>
                  <PasswordInput
                    id="newPassword"
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNewPassword}
                    setShow={setShowNewPassword}
                    disabled={submitting}
                    placeholder="At least 8 characters"
                  />
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div key={level} className={`h-1 rounded-full ${score >= level ? 'bg-emerald-400' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>

                <StatusMessages error={errorMessage} success={successMessage} />

                <Button
                  type="submit"
                  disabled={submitting || !resetCodeSent || otp.length !== 6}
                  className="h-12 w-full rounded-2xl bg-indigo-500 font-bold text-white hover:bg-indigo-400 disabled:opacity-60"
                >
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating password</> : 'Update password'}
                </Button>

                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Back to login
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-xs leading-6 text-slate-500">
              Don&apos;t have an account? <a href="/register" className="font-semibold text-indigo-300 hover:text-indigo-200">Create merchant account</a>.
              <br />
              Need help? <a href="https://wa.me/201114671033" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-400 hover:text-emerald-300">WhatsApp: +201114671033</a> • <a href={`mailto:${SYSTEM_EMAIL}`} className="font-semibold text-indigo-300 hover:text-indigo-200">{SYSTEM_EMAIL}</a>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function EmailField({ email, setEmail, disabled }: { email: string; setEmail: (value: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="email" className="text-xs font-semibold text-slate-300">Email</Label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          id="email"
          type="email"
          placeholder="owner@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
          required
          disabled={disabled}
        />
      </div>
    </div>
  )
}

function PasswordInput({
  id,
  value,
  onChange,
  show,
  setShow,
  disabled,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  show: boolean
  setShow: (value: boolean) => void
  disabled: boolean
  placeholder: string
}) {
  return (
    <div className="relative">
      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-2xl border-white/10 bg-white/[0.04] px-10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
        required
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function StatusMessages({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
          {success}
        </div>
      )}
    </>
  )
}
