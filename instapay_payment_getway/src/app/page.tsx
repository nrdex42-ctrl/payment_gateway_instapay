import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Code2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Webhook,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: <CreditCard className="h-5 w-5" />,
    title: 'Hosted checkout',
    body: 'Create payment sessions with a simple API and route customers to a clean hosted payment page.',
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Automatic confirmation',
    body: 'Confirm InstaPay transfers quickly using your connected merchant receiving account.',
  },
  {
    icon: <Webhook className="h-5 w-5" />,
    title: 'Signed webhooks',
    body: 'Receive HMAC-signed payment events on your backend for reliable order fulfillment.',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Merchant analytics',
    body: 'Track confirmed, pending, expired, and mismatched payments from one operational dashboard.',
  },
]

const plans = [
  { name: 'Basic', price: '250 EGP', limit: '500 confirmations / month' },
  { name: 'Pro', price: '750 EGP', limit: '2,000 confirmations / month', popular: true },
  { name: 'Enterprise', price: 'Custom', limit: 'High-volume processing and support' },
]

const steps = [
  'Create a merchant account',
  'Configure your receiving InstaPay payment link',
  'Generate checkout sessions from your backend',
  'Receive signed confirmation webhooks',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-950/40">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight sm:text-base">InstaPay Gateway</div>
              <div className="text-xs text-slate-400">Payment infrastructure for Egypt</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#integration" className="hover:text-white">Integration</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex">
              <a href="/login">Sign in</a>
            </Button>
            <Button asChild size="sm" className="rounded-xl bg-white text-slate-950 hover:bg-slate-200">
              <a href="/register">
                Start now
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.25),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(6,182,212,0.18),transparent_28%),radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.18),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                <Clock3 className="h-3.5 w-3.5" />
                Fast InstaPay payment confirmation for online businesses
              </div>

              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                Accept InstaPay payments with automated confirmation.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                A merchant payment gateway for creating checkout sessions, detecting successful transfers,
                and delivering secure webhook callbacks to your business system.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-2xl bg-indigo-500 px-7 text-white hover:bg-indigo-400">
                  <a href="/register">
                    Create merchant account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl border-white/15 bg-white/5 px-7 text-white hover:bg-white/10">
                  <a href="/login">Merchant login</a>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> API-first checkout</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Signed callbacks</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Merchant dashboard</span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live operations</p>
                    <h2 className="mt-1 text-xl font-bold">Payment control center</h2>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">Online</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ['Confirmation rate', '99.9%'],
                    ['Webhook signing', 'HMAC'],
                    ['Checkout expiry', 'Configurable'],
                    ['Settlement currency', 'EGP'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs text-slate-400">{label}</div>
                      <div className="mt-2 text-lg font-black">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Developer-ready integration</div>
                      <div className="text-xs leading-5 text-slate-400">Create checkout, redirect customer, verify webhook, fulfill order.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Platform features</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Everything needed to operate InstaPay checkout.</h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="integration" className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Integration flow</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Simple payment lifecycle.</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
                Your backend creates a session, the customer pays using InstaPay, and your system receives
                a signed confirmation event when the transfer is detected.
              </p>
            </div>

            <div className="grid gap-3">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-sm font-black">
                    {index + 1}
                  </div>
                  <div className="font-semibold text-slate-100">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Pricing</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Monthly plans for growing merchants.</h2>
            </div>
            <Button asChild className="w-fit rounded-2xl bg-white text-slate-950 hover:bg-slate-200">
              <a href="/register">Choose a plan</a>
            </Button>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl border p-6 ${
                  plan.popular
                    ? 'border-indigo-400/50 bg-indigo-500/10 shadow-xl shadow-indigo-950/30'
                    : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black">{plan.name}</h3>
                  {plan.popular && <span className="rounded-full bg-indigo-400/20 px-3 py-1 text-xs font-bold text-indigo-200">Popular</span>}
                </div>
                <div className="mt-5 text-3xl font-black">{plan.price}</div>
                <div className="mt-2 text-sm text-slate-400">{plan.limit}</div>
                <Button asChild className="mt-6 w-full rounded-2xl bg-white text-slate-950 hover:bg-slate-200">
                  <a href="/register">Get started</a>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-indigo-500/20 to-cyan-400/10 p-8 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                  <LockKeyhole className="h-4 w-4" />
                  Built for secure merchant operations
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Start accepting InstaPay payments through your own business flow.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  Register your merchant account, configure your payment settings, and connect your backend using API keys and signed webhooks.
                </p>
              </div>
              <Button asChild size="lg" className="rounded-2xl bg-white text-slate-950 hover:bg-slate-200">
                <a href="/register">
                  Open merchant account
                  <Smartphone className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>© {new Date().getFullYear()} InstaPay Gateway. Merchant payment infrastructure.</div>
          <div className="flex gap-5">
            <a href="/login" className="hover:text-slate-300">Login</a>
            <a href="/register" className="hover:text-slate-300">Register</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
