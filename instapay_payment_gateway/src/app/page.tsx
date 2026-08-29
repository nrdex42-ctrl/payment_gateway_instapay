import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  CreditCard,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Webhook,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'

export const revalidate = 3600

const features = [
  {
    icon: <CreditCard className="h-5 w-5" />,
    title: 'Hosted checkout',
    body: 'Create a payment session from your backend and redirect the customer to a hosted page that shows the exact amount and recipient.',
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Automated confirmation',
    body: 'A paired detector app on your receiving device reports incoming InstaPay transfers, so orders are confirmed without manual checking.',
  },
  {
    icon: <Webhook className="h-5 w-5" />,
    title: 'Signed webhooks',
    body: 'Each event is delivered with an HMAC-SHA256 signature, event ID, and timestamp so your server can verify it and reject replays.',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Operational dashboard',
    body: 'Review confirmed, pending, expired, and mismatched payments, export records, and manage your plan from one place.',
  },
  {
    icon: <KeyRound className="h-5 w-5" />,
    title: 'Scoped API keys',
    body: 'Server-side API keys are stored hashed and scoped to your merchant account, with separate credentials for the detector device.',
  },
  {
    icon: <RefreshCw className="h-5 w-5" />,
    title: 'Amount reconciliation',
    body: 'Transfers that do not match an open session are recorded as mismatched payments instead of being silently dropped.',
  },
]

const steps = [
  {
    title: 'Register and get approved',
    body: 'Create a merchant account with your receiving InstaPay handle. Accounts are reviewed before going live.',
  },
  {
    title: 'Configure your payment link',
    body: 'Add your static InstaPay payment URL and the webhook endpoint that should receive confirmation events.',
  },
  {
    title: 'Create checkout sessions',
    body: 'Call the checkout API from your backend with an amount and reference, then redirect the customer to the returned link.',
  },
  {
    title: 'Fulfill on webhook',
    body: 'Verify the signature on the incoming event and release the order once the transfer is confirmed.',
  },
]

const securityPoints = [
  'HMAC-SHA256 signed webhooks with event IDs and timestamps for replay protection',
  'API keys and detector tokens stored as hashes, never in plain text',
  'Merchant webhook endpoints restricted to public HTTPS URLs',
  'Scoped merchant sessions with expiring signed tokens',
]

const planCopy: Record<string, { label: string; blurb: string }> = {
  FREE_TRIAL: { label: 'Free Trial', blurb: 'Try the full integration before committing.' },
  BASIC: { label: 'Basic', blurb: 'For small stores getting their first orders online.' },
  PRO: { label: 'Pro', blurb: 'For growing businesses with steady daily volume.' },
  ENTERPRISE: { label: 'Enterprise', blurb: 'For high-volume merchants and marketplaces.' },
}

const codeSample = `// 1. Create a checkout session from your backend
const res = await fetch('https://your-gateway.example.com/api/v1/checkout/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${process.env.INSTAPAY_API_KEY}\`,
  },
  body: JSON.stringify({
    amountEgp: 50.0,
    senderHandle: 'customer@instapay',
    note: 'Order #1004',
  }),
})

const { checkout } = await res.json()

// 2. Send the customer to the InstaPay payment link
redirect(checkout.deepLinkUrl)`

async function getPlans() {
  try {
    return await db.plan.findMany({
      select: { id: true, name: true, priceEgp: true, maxTransactions: true },
      orderBy: { priceEgp: 'asc' },
    })
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const plans = await getPlans()
  const paidPlans = plans.filter((plan) => plan.priceEgp > 0)
  const trialPlan = plans.find((plan) => plan.name === 'FREE_TRIAL')
  const popularPlan = paidPlans.length > 1 ? paidPlans[1]?.name : paidPlans[0]?.name

  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg shadow-indigo-950/40">
              <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight sm:text-base">InstaPay Gateway</div>
              <div className="hidden text-xs text-slate-400 sm:block">Payment infrastructure for Egypt</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how-it-works" className="hover:text-white">How it works</a>
            <a href="#developers" className="hover:text-white">Developers</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div data-language-toggle-slot data-i18n-skip />
            <Button asChild variant="ghost" size="sm" className="hidden text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex">
              <a href="/login">Sign in</a>
            </Button>
            <Button asChild size="sm" className="rounded-xl bg-white text-slate-950 hover:bg-slate-200">
              <a href="/register">
                Get started
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
                <ShieldCheck className="h-3.5 w-3.5" />
                Built for Egyptian merchants on InstaPay
              </div>

              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                Accept InstaPay payments with automated confirmation.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Create checkout sessions from your backend, let your customers pay in the official
                InstaPay app, and receive a signed webhook the moment the transfer is confirmed.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-2xl bg-indigo-500 px-7 text-white hover:bg-indigo-400">
                  <a href="/register">
                    Create merchant account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl border-white/15 bg-white/5 px-7 text-white hover:bg-white/10">
                  <a href="#developers">View integration</a>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> REST checkout API</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Signed webhooks</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Settled in EGP</span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-5">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <Terminal className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Checkout request
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <pre className="text-[11px] leading-6 text-slate-300 sm:text-xs">
                    <code>{codeSample}</code>
                  </pre>
                </div>

                <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                  {[
                    ['Settlement currency', 'EGP'],
                    ['Webhook signature', 'HMAC-SHA256'],
                    ['Session expiry', 'Configurable'],
                    ['Integration', 'REST + webhooks'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs text-slate-400">{label}</div>
                      <div className="mt-1.5 text-sm font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Platform</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Everything needed to run InstaPay checkout.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              The gateway handles session creation, transfer detection, reconciliation, and delivery
              of confirmation events to your systems.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <section id="how-it-works" className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">How it works</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                From checkout to confirmed order.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
                Money moves through InstaPay directly into your own account. The gateway coordinates
                the session, detects the incoming transfer, and tells your backend when to fulfill.
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm leading-7 text-slate-400">
                Funds are transferred merchant-to-customer inside InstaPay. The gateway never holds
                or forwards customer money.
              </div>
            </div>

            <div className="grid gap-3">
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-sm font-black">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">{step.title}</div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-400">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="developers" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Developers</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                A small API surface, verifiable events.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-400">
                Two endpoints cover the payment lifecycle: create a session and read its status.
                Everything else arrives as a signed webhook. Snippets for cURL, JavaScript, Python,
                and PHP are available in your dashboard once your account is approved.
              </p>

              <div className="mt-7 space-y-3">
                {[
                  ['POST', '/api/v1/checkout/create', 'Create a payment session'],
                  ['GET', '/api/v1/checkout/status', 'Read the status of a session'],
                  ['POST', 'your webhook URL', 'Receive signed confirmation events'],
                ].map(([method, path, label]) => (
                  <div key={path} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <span className="rounded-lg bg-indigo-500/20 px-2 py-1 text-[11px] font-black tracking-wide text-indigo-200">
                      {method}
                    </span>
                    <code className="text-xs text-slate-200">{path}</code>
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">Webhook verification</div>
                  <div className="text-xs text-slate-400">Reject anything that fails the check.</div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <pre className="text-[11px] leading-6 text-slate-300 sm:text-xs">
                  <code>{`const expected = crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest('hex')

if (\`v1=\${expected}\` !== signatureHeader) {
  return res.status(400).end()
}`}</code>
                </pre>
              </div>

              <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-5">
                {securityPoints.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm leading-6 text-slate-400">
                    <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Pricing</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Monthly plans based on confirmed transactions.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Every plan includes the full API, dashboard, and signed webhooks. Plans differ only
                in how many confirmed transactions they cover each month.
              </p>
            </div>

            {paidPlans.length > 0 ? (
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {paidPlans.map((plan) => {
                  const copy = planCopy[plan.name]
                  const isPopular = plan.name === popularPlan
                  return (
                    <div
                      key={plan.id}
                      className={`flex flex-col rounded-3xl border p-6 ${
                        isPopular
                          ? 'border-indigo-400/50 bg-indigo-500/10 shadow-xl shadow-indigo-950/30'
                          : 'border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xl font-black">
                          {copy?.label ?? plan.name.replace(/_/g, ' ')}
                        </h3>
                        {isPopular && (
                          <span className="rounded-full bg-indigo-400/20 px-3 py-1 text-xs font-bold text-indigo-200">
                            Most popular
                          </span>
                        )}
                      </div>

                      <div className="mt-5 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black">
                          {plan.priceEgp.toLocaleString('en-EG')}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">EGP / month</span>
                      </div>

                      <div className="mt-2 text-sm text-slate-400">
                        Up to {plan.maxTransactions.toLocaleString('en-EG')} confirmed transactions
                      </div>

                      {copy?.blurb && (
                        <p className="mt-4 text-sm leading-6 text-slate-500">{copy.blurb}</p>
                      )}

                      <Button asChild className="mt-6 w-full rounded-2xl bg-white text-slate-950 hover:bg-slate-200">
                        <a href="/register">Get started</a>
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
                Plan details are available after you create a merchant account.
              </div>
            )}

            {trialPlan && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  New merchants start on a free trial covering{' '}
                  {trialPlan.maxTransactions.toLocaleString('en-EG')} confirmed transactions. No
                  payment required to test your integration.
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-indigo-500/20 to-cyan-400/10 p-8 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                  <Code2 className="h-4 w-4" />
                  Ready when you are
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight">
                  Start accepting InstaPay payments in your own checkout.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  Register your merchant account, configure your payment link and webhook endpoint,
                  and go live once your account is approved.
                </p>
              </div>
              <Button asChild size="lg" className="rounded-2xl bg-white text-slate-950 hover:bg-slate-200">
                <a href="/register">
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050710]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
                  <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
                </div>
                <div className="text-sm font-black tracking-tight">InstaPay Gateway</div>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
                Merchant payment infrastructure for accepting InstaPay transfers in Egypt.
              </p>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Product</div>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-slate-300">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-300">How it works</a></li>
                <li><a href="#pricing" className="hover:text-slate-300">Pricing</a></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Developers</div>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
                <li><a href="#developers" className="hover:text-slate-300">Integration overview</a></li>
                <li><a href="/login" className="hover:text-slate-300">API keys</a></li>
                <li><a href="/login" className="hover:text-slate-300">Webhook settings</a></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Account</div>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
                <li><a href="/register" className="hover:text-slate-300">Create account</a></li>
                <li><a href="/login" className="hover:text-slate-300">Merchant sign in</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} InstaPay Gateway. All rights reserved.</div>
            <div>
              Not affiliated with the Central Bank of Egypt or the Instant Payment Network.
              Payments are completed in the official InstaPay app.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
