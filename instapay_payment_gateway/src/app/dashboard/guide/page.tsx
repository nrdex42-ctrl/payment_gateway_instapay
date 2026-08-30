'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Lock,
  RefreshCw,
  Shield,
  Smartphone,
  Terminal,
  Webhook,
  Zap,
  AlertTriangle,
  Info,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ───────────────────────────── types ───────────────────────────── */

interface ClientSession {
  id: string
  slug: string
  businessName: string
  instapayHandle: string
  instapayPaymentUrl: string | null
  email: string
  apiKey: string | null
  detectToken: string | null
  webhookUrl: string | null
  webhookSecret: string | null
  checkoutTtlMin: number
  subscriptionPlan: string
  subscriptionEndsAt: string | null
  isFreeTrial: boolean
  txLimit: number
  txCount: number
}

type SnippetLang = 'curl' | 'javascript' | 'python' | 'php'
type WebhookLang = 'node' | 'python' | 'php'

/* ───────────────────────────── page ───────────────────────────── */

export default function IntegrationGuidePage() {
  const router = useRouter()
  const [client, setClient] = useState<ClientSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [snippetTab, setSnippetTab] = useState<SnippetLang>('curl')
  const [webhookTab, setWebhookTab] = useState<WebhookLang>('node')

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (data.ok) {
          setClient(data.client)
        } else {
          router.push('/login')
        }
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [router])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const maskSecret = (value: string | null | undefined) => {
    if (!value) return 'Not generated'
    if (value.length <= 12) return '••••••••'
    return `${value.slice(0, 6)}••••••••${value.slice(-4)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070a12] text-neutral-400">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
            <img src="/IPN.svg" alt="InstaPay Gateway" className="h-full w-full object-contain" />
          </div>
          <RefreshCw className="h-5 w-5 animate-spin text-violet-400 mx-auto" />
          <p className="text-xs">Loading integration guide…</p>
        </div>
      </div>
    )
  }

  if (!client) return null

  const GATEWAY = 'https://instapay-ruddy.vercel.app'
  const apiKey = client.apiKey || 'YOUR_API_KEY'
  const webhookSecret = client.webhookSecret || 'YOUR_WEBHOOK_SECRET'

  /* ── setup checklist items ── */
  const checklist = [
    { label: 'Merchant account approved', done: true, section: 'Account' },
    { label: 'InstaPay handle configured', done: Boolean(client.instapayHandle && !client.instapayHandle.startsWith(`${client.slug}@`)), section: 'Dashboard' },
    { label: 'Static payment URL pasted', done: Boolean(client.instapayPaymentUrl), section: 'Dashboard' },
    { label: 'Webhook URL set (HTTPS)', done: Boolean(client.webhookUrl), section: 'Dashboard' },
    { label: 'API Key generated', done: Boolean(client.apiKey), section: 'Dashboard' },
    { label: 'Webhook Secret generated', done: Boolean(client.webhookSecret), section: 'Dashboard' },
    { label: 'Backend: checkout creation endpoint', done: false, section: 'Your Store' },
    { label: 'Backend: webhook handler with signature verification', done: false, section: 'Your Store' },
    { label: 'Backend: idempotent order fulfillment', done: false, section: 'Your Store' },
    { label: 'Frontend: "Pay with InstaPay" button', done: false, section: 'Your Store' },
    { label: 'Detector APK installed & notification access granted', done: false, section: 'Phone' },
    { label: 'End-to-end test completed', done: false, section: 'Testing' },
  ]

  /* ── code snippets with real keys ── */
  const checkoutSnippets: Record<SnippetLang, string> = {
    curl: `curl -X POST ${GATEWAY}/api/v1/checkout/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1234"
  }'`,
    javascript: `const response = await fetch('${GATEWAY}/api/v1/checkout/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiKey}'
  },
  body: JSON.stringify({
    amountEgp: 150.00,
    senderHandle: 'customer@instapay',
    note: 'Order #1234'
  })
});
const { ok, checkout, error } = await response.json();
if (!ok) throw new Error(error);

// Redirect customer to payment
window.location.href = checkout.deepLinkUrl;

// Or poll status
const statusRes = await fetch(
  \`${GATEWAY}/api/v1/checkout/status?sessionId=\${checkout.sessionId}\`
);
const statusData = await statusRes.json();
console.log('Status:', statusData.checkout.status);`,
    python: `import requests

url = "${GATEWAY}/api/v1/checkout/create"
headers = {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
}
payload = {
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1234"
}

res = requests.post(url, json=payload, headers=headers).json()
if not res.get("ok"):
    raise Exception(res.get("error", "Unknown error"))

checkout = res["checkout"]
print(f"Session ID: {checkout['sessionId']}")
print(f"Deep Link: {checkout['deepLinkUrl']}")

# Check status
status = requests.get(
    f"${GATEWAY}/api/v1/checkout/status?sessionId={checkout['sessionId']}"
).json()
print(f"Status: {status['checkout']['status']}")`,
    php: `<?php
$ch = curl_init("${GATEWAY}/api/v1/checkout/create");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ${apiKey}'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amountEgp'    => 150.00,
        'senderHandle' => 'customer@instapay',
        'note'         => 'Order #1234'
    ]),
]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if (!$response['ok']) throw new Exception($response['error']);
$checkout = $response['checkout'];
echo "Session: " . $checkout['sessionId'] . "\\n";
echo "Pay Link: " . $checkout['deepLinkUrl'] . "\\n";
?>`,
  }

  const webhookSnippets: Record<WebhookLang, string> = {
    node: `const crypto = require('crypto');
const express = require('express');
const app = express();

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));

const WEBHOOK_SECRET = '${webhookSecret}';
const processedEvents = new Set(); // Use your database in production

app.post('/webhook/instapay', (req, res) => {
  const signature = req.headers['x-instapay-signature'];
  const timestamp = req.headers['x-instapay-timestamp'];
  const eventId   = req.headers['x-instapay-event-id'];

  // 1. Verify required headers
  if (!signature || !timestamp || !eventId) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // 2. Reject stale timestamps (> 5 minutes)
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) {
    return res.status(400).json({ error: 'Expired timestamp' });
  }

  // 3. Verify HMAC-SHA256 signature
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(\`\${timestamp}.\${req.rawBody}\`)
    .digest('hex');
  const provided = String(signature).replace(/^v1=/, '').trim();
  const valid =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 4. Deduplicate
  if (processedEvents.has(eventId)) {
    return res.status(200).json({ ok: true, duplicate: true });
  }
  processedEvents.add(eventId);

  // 5. Process event
  const { event, transaction } = req.body;
  if (event === 'payment.confirmed') {
    console.log(\`✅ Payment: \${transaction.amountEgp} EGP from \${transaction.senderHandle}\`);
    // TODO: fulfill order in your database
  } else if (event === 'payment.underpaid') {
    console.log(\`⚠️ Underpaid: got \${transaction.detectedAmountEgp} of \${transaction.amountEgp}\`);
    // TODO: flag for manual review
  }

  res.status(200).json({ received: true });
});

app.listen(3001, () => console.log('Webhook server on :3001'));`,
    python: `import hmac, hashlib, time, os
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = '${webhookSecret}'

@app.route("/webhook/instapay", methods=["POST"])
def webhook():
    signature = request.headers.get("X-Instapay-Signature", "")
    timestamp = request.headers.get("X-Instapay-Timestamp", "")
    event_id  = request.headers.get("X-Instapay-Event-Id", "")

    if not all([signature, timestamp, event_id]):
        return jsonify(error="Missing headers"), 401

    # Reject stale timestamps
    age = abs(int(time.time()) - int(timestamp))
    if age > 300:
        return jsonify(error="Expired timestamp"), 400

    # Verify HMAC-SHA256 signature
    raw_body = request.get_data(as_text=True)
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        f"{timestamp}.{raw_body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    provided = signature.replace("v1=", "").strip()

    if not hmac.compare_digest(expected, provided):
        return jsonify(error="Invalid signature"), 401

    body = request.get_json()
    event = body.get("event")
    tx = body.get("transaction", {})

    if event == "payment.confirmed":
        print(f"✅ {tx['amountEgp']} EGP from {tx['senderHandle']}")
        # TODO: fulfill order

    return jsonify(received=True), 200`,
    php: `<?php
$rawBody   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_INSTAPAY_SIGNATURE'] ?? '';
$timestamp = $_SERVER['HTTP_X_INSTAPAY_TIMESTAMP'] ?? '';
$eventId   = $_SERVER['HTTP_X_INSTAPAY_EVENT_ID'] ?? '';

if (!$signature || !$timestamp || !$eventId) {
    http_response_code(401);
    echo json_encode(['error' => 'Missing headers']);
    exit;
}

if (abs(time() - intval($timestamp)) > 300) {
    http_response_code(400);
    echo json_encode(['error' => 'Expired timestamp']);
    exit;
}

$expected = hash_hmac('sha256', "{$timestamp}.{$rawBody}", '${webhookSecret}');
$provided = str_replace('v1=', '', trim($signature));
if (!hash_equals($expected, $provided)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$body  = json_decode($rawBody, true);
$event = $body['event'];
$tx    = $body['transaction'];

if ($event === 'payment.confirmed') {
    // Fulfill order
    // DB::table('orders')->where('session_id', $tx['sessionId'])->update(['status' => 'paid']);
}

http_response_code(200);
echo json_encode(['received' => true]);
?>`,
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-neutral-100 font-sans selection:bg-violet-500/30">
      {/* ─── Sticky Header ─── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-xs font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="h-5 w-px bg-neutral-800" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
                <img src="/IPN.svg" alt="IPN" className="h-full w-full object-contain" />
              </div>
              <span className="text-sm font-bold text-white">Integration Guide</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[10px] text-neutral-500 font-mono">
              {client.businessName}
            </span>
            <div data-language-toggle-slot data-i18n-skip />
            <Link href="/docs" target="_blank">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-neutral-800 bg-white/[0.03] text-neutral-400 hover:bg-white/10 hover:text-white text-xs"
              >
                <ExternalLink className="mr-1.5 h-3 w-3" />
                Public API Docs
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Sidebar Nav + Main Content ─── */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-5 text-xs">
            <NavGroup icon={<BookOpen className="h-3.5 w-3.5" />} title="Getting Started">
              <NavLink href="#overview">Overview</NavLink>
              <NavLink href="#flow">Payment Flow</NavLink>
              <NavLink href="#setup">Dashboard Setup</NavLink>
              <NavLink href="#checklist">Checklist</NavLink>
            </NavGroup>
            <NavGroup icon={<Terminal className="h-3.5 w-3.5" />} title="API Reference">
              <NavLink href="#create-checkout" badge="POST" badgeColor="emerald">Create Checkout</NavLink>
              <NavLink href="#check-status" badge="GET" badgeColor="blue">Check Status</NavLink>
            </NavGroup>
            <NavGroup icon={<Webhook className="h-3.5 w-3.5" />} title="Webhooks">
              <NavLink href="#webhook-overview">Overview</NavLink>
              <NavLink href="#webhook-signature">Signature Verification</NavLink>
              <NavLink href="#webhook-code">Handler Examples</NavLink>
            </NavGroup>
            <NavGroup icon={<Zap className="h-3.5 w-3.5" />} title="Frontend">
              <NavLink href="#frontend-button">Checkout Button</NavLink>
            </NavGroup>
            <NavGroup icon={<Shield className="h-3.5 w-3.5" />} title="Operations">
              <NavLink href="#best-practices">Best Practices</NavLink>
              <NavLink href="#rate-limits">Rate Limits</NavLink>
            </NavGroup>
          </nav>
        </aside>

        {/* Main */}
        <main className="space-y-12 min-w-0">
          {/* ═══════ OVERVIEW ═══════ */}
          <section id="overview" className="scroll-mt-24 space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Store Integration Guide
              </h1>
              <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
                Everything you need to accept InstaPay payments in your online store. This guide is personalized with your live credentials.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureCard
                icon={<Zap className="h-5 w-5" />}
                title="Simple API"
                description="One POST request creates a checkout. One GET polls the status."
              />
              <FeatureCard
                icon={<Globe className="h-5 w-5" />}
                title="Instant Webhooks"
                description="Real-time POST callbacks when payments are confirmed."
              />
              <FeatureCard
                icon={<Lock className="h-5 w-5" />}
                title="HMAC-SHA256 Signed"
                description="Every webhook carries a timestamped cryptographic signature."
              />
            </div>
          </section>

          {/* ═══════ PAYMENT FLOW DIAGRAM ═══════ */}
          <section id="flow" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Payment Flow" subtitle="How a checkout moves from creation to fulfillment" />

            {/* Advanced animated flowchart */}
            <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-[#0c1020] to-neutral-950 p-5 sm:p-8 overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Row 1: Store → Gateway → Store */}
                <div className="flex items-center gap-0">
                  <FlowNode
                    icon={<Terminal className="h-5 w-5" />}
                    label="Your Store"
                    sublabel="Backend Server"
                    color="violet"
                    pulse
                  />
                  <FlowArrow label="1. POST /api/v1/checkout/create" sublabel="amountEgp, senderHandle, note" direction="right" />
                  <FlowNode
                    icon={<Globe className="h-5 w-5" />}
                    label="InstaPay Gateway"
                    sublabel="API Server"
                    color="indigo"
                  />
                  <FlowArrow label="2. Returns checkout" sublabel="sessionId, deepLinkUrl, expiresAt" direction="right" dashed />
                  <FlowNode
                    icon={<Terminal className="h-5 w-5" />}
                    label="Your Store"
                    sublabel="Shows payment page"
                    color="violet"
                  />
                </div>

                {/* Connector down from store */}
                <div className="flex items-start">
                  <div className="w-[136px]" />
                  <div className="w-[136px]" />
                  <div className="w-[136px]" />
                  <div className="w-[136px]" />
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-px bg-gradient-to-b from-violet-500/60 to-amber-500/60" />
                    <ChevronRight className="h-3.5 w-3.5 text-amber-400 rotate-90 -mt-0.5" />
                  </div>
                </div>

                {/* Row 2: Customer pays */}
                <div className="flex items-center justify-end gap-0 pr-0">
                  <FlowNode
                    icon={<Smartphone className="h-5 w-5" />}
                    label="Customer"
                    sublabel="Opens InstaPay app"
                    color="amber"
                    pulse
                  />
                  <FlowArrow label="3. Pays exact amount" sublabel="via official InstaPay app" direction="right" color="amber" />
                  <FlowNode
                    icon={<span className="text-xs font-black">IPN</span>}
                    label="InstaPay Network"
                    sublabel="Official banking rails"
                    color="amber"
                  />
                  <FlowArrow label="4. Receipt notification" sublabel="on merchant phone" direction="right" color="amber" dashed />
                  <FlowNode
                    icon={<Smartphone className="h-5 w-5" />}
                    label="Merchant Phone"
                    sublabel="Receives notification"
                    color="amber"
                  />
                </div>

                {/* Connector down from phone */}
                <div className="flex items-start">
                  <div className="w-[136px]" />
                  <div className="w-[136px]" />
                  <div className="w-[136px]" />
                  <div className="w-[136px]" />
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-px bg-gradient-to-b from-amber-500/60 to-emerald-500/60" />
                    <ChevronRight className="h-3.5 w-3.5 text-emerald-400 rotate-90 -mt-0.5" />
                  </div>
                </div>

                {/* Row 3: Detection → Confirmation → Webhook */}
                <div className="flex items-center gap-0">
                  <FlowNode
                    icon={<Terminal className="h-5 w-5" />}
                    label="Your Store"
                    sublabel="Webhook handler"
                    color="emerald"
                    pulse
                  />
                  <FlowArrow label="7. POST webhook callback" sublabel="payment.confirmed event" direction="left" color="emerald" />
                  <FlowNode
                    icon={<Globe className="h-5 w-5" />}
                    label="Gateway Matcher"
                    sublabel="Matches PENDING checkout"
                    color="emerald"
                  />
                  <FlowArrow label="6. Reports payment" sublabel="amount, sender, reference" direction="left" color="emerald" />
                  <FlowNode
                    icon={<Smartphone className="h-5 w-5" />}
                    label="Detector APK"
                    sublabel="Parses notification"
                    color="emerald"
                  />
                </div>

                {/* Final result arrow */}
                <div className="flex items-start">
                  <div className="flex flex-col items-center">
                    <div className="h-6 w-px bg-gradient-to-b from-emerald-500/60 to-emerald-400" />
                    <ChevronRight className="h-3.5 w-3.5 text-emerald-400 rotate-90 -mt-0.5" />
                  </div>
                </div>

                {/* Final node */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 px-5 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-emerald-300">Order Fulfilled ✓</div>
                      <div className="text-[10px] text-emerald-400/70 font-medium">Verify signature → mark paid → ship product</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction lifecycle */}
            <div className="grid gap-3 sm:grid-cols-4">
              <StatusCard status="PENDING" description="Checkout created, waiting for customer payment" color="amber" />
              <StatusCard status="CONFIRMED" description="Payment detected and matched to checkout" color="emerald" />
              <StatusCard status="EXPIRED" description="TTL elapsed with no matching payment detected" color="neutral" />
              <StatusCard status="UNDERPAID" description="Payment received but amount was lower than expected" color="red" />
            </div>
          </section>

          {/* ═══════ DASHBOARD SETUP ═══════ */}
          <section id="setup" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Dashboard Setup" subtitle="Configure these settings in your merchant dashboard before writing code" />

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
              <div className="border-b border-neutral-800 bg-neutral-900/50 px-5 py-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Your Live Credentials</h3>
              </div>
              <div className="p-5 space-y-4 text-xs">
                <CredentialRow
                  label="API Key"
                  value={client.apiKey}
                  masked={maskSecret(client.apiKey)}
                  description="Bearer token for checkout creation requests"
                  onCopy={() => handleCopy(client.apiKey || '', 'apikey')}
                  copied={copiedId === 'apikey'}
                />
                <CredentialRow
                  label="Webhook Secret"
                  value={client.webhookSecret}
                  masked={maskSecret(client.webhookSecret)}
                  description="HMAC-SHA256 key for verifying webhook signatures"
                  onCopy={() => handleCopy(client.webhookSecret || '', 'secret')}
                  copied={copiedId === 'secret'}
                />
                <CredentialRow
                  label="Detect Token"
                  value={client.detectToken}
                  masked={maskSecret(client.detectToken)}
                  description="Auth token for the Android Detector APK"
                  onCopy={() => handleCopy(client.detectToken || '', 'detect')}
                  copied={copiedId === 'detect'}
                />

                <div className="border-t border-neutral-800 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-neutral-500 font-semibold">InstaPay Handle</span>
                    <p className="mt-1 font-mono text-neutral-300">{client.instapayHandle || '—'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Webhook URL</span>
                    <p className="mt-1 font-mono text-neutral-300 break-all">{client.webhookUrl || '—'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Payment URL</span>
                    <p className="mt-1 font-mono text-neutral-300 break-all">{client.instapayPaymentUrl || '—'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Checkout TTL</span>
                    <p className="mt-1 font-mono text-neutral-300">{client.checkoutTtlMin} minutes</p>
                  </div>
                </div>
              </div>
            </div>

            <AlertBox type="warning">
              Never expose your <strong>API Key</strong> or <strong>Webhook Secret</strong> in frontend JavaScript, mobile apps, or public repositories. Use them only on your backend server.
            </AlertBox>

            <AlertBox type="important">
              The <strong>Detector APK must be running</strong> on the phone that receives InstaPay payments. Without it, payment confirmations will never reach your store.
            </AlertBox>
          </section>

          {/* ═══════ CHECKLIST ═══════ */}
          <section id="checklist" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Integration Checklist" subtitle="Track your progress — gateway items update automatically from your dashboard settings" />

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5">
              <div className="space-y-2">
                {checklist.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs transition-colors ${
                      item.done
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                        : 'border-neutral-800 bg-neutral-950/50 text-neutral-400'
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                      item.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-600'
                    }`}>
                      {item.done ? <Check className="h-3 w-3" /> : <span className="text-[9px] font-bold">{i + 1}</span>}
                    </span>
                    <span className={`flex-1 ${item.done ? 'font-semibold' : ''}`}>{item.label}</span>
                    <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                      {item.section}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">
                  {checklist.filter(c => c.done).length} / {checklist.length} completed
                </span>
                <Link href="/dashboard">
                  <Button size="sm" className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs">
                    Open Dashboard Settings
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* ═══════ CREATE CHECKOUT ═══════ */}
          <section id="create-checkout" className="scroll-mt-24 space-y-5">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-black text-emerald-400 uppercase tracking-wider">POST</span>
              <h2 className="text-2xl font-black text-white">Create Checkout</h2>
            </div>
            <p className="text-sm text-neutral-400">Creates a new checkout session and returns the session parameters, deep link URL, and timestamps.</p>

            <CodeBlock code={`POST ${GATEWAY}/api/v1/checkout/create`} onCopy={() => handleCopy(`${GATEWAY}/api/v1/checkout/create`, 'endpoint')} copied={copiedId === 'endpoint'} />

            {/* Headers */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Request Headers</h4>
              <div className="rounded-xl border border-neutral-800 overflow-hidden text-xs">
                <div className="grid grid-cols-2 bg-neutral-900/50 px-4 py-2 font-bold text-neutral-400 border-b border-neutral-800">
                  <span>Header</span><span>Value</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2 border-b border-neutral-800/50">
                  <span className="font-mono text-indigo-300">Content-Type</span>
                  <span className="text-neutral-300">application/json</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2">
                  <span className="font-mono text-indigo-300">Authorization</span>
                  <span className="text-neutral-300">Bearer YOUR_API_KEY</span>
                </div>
              </div>
            </div>

            {/* Request body */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Request Body</h4>
              <ParamTable params={[
                { name: 'amountEgp', type: 'number', required: true, description: 'Amount in EGP. Must be positive. Stored with piaster-level (cent) precision.' },
                { name: 'senderHandle', type: 'string', required: true, description: 'Customer\'s InstaPay handle (e.g. "customer@instapay"). Used for matching.' },
                { name: 'note', type: 'string', required: false, description: 'Order reference / note, max 200 characters.' },
              ]} />
            </div>

            {/* Tabbed code snippets */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Code Examples</h4>
              <TabbedCode<SnippetLang>
                tabs={[
                  { id: 'curl', label: 'cURL' },
                  { id: 'javascript', label: 'JavaScript' },
                  { id: 'python', label: 'Python' },
                  { id: 'php', label: 'PHP' },
                ]}
                activeTab={snippetTab}
                onTabChange={setSnippetTab}
                code={checkoutSnippets[snippetTab]}
                onCopy={() => handleCopy(checkoutSnippets[snippetTab], 'snippet')}
                copied={copiedId === 'snippet'}
              />
            </div>

            {/* Success response */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Success Response (200)</h4>
              <CodeBlock
                code={JSON.stringify({
                  ok: true,
                  checkout: {
                    sessionId: 'cmt7qyzda000...',
                    senderHandle: 'customer@instapay',
                    recipientHandle: client.instapayHandle || 'merchant@instapay',
                    amountEgp: 150,
                    currency: 'EGP',
                    status: 'PENDING',
                    note: 'Order #1234',
                    deepLinkUrl: client.instapayPaymentUrl || 'https://ipn.eg/S/merchant/instapay/token',
                    deepLinkToken: '1QduWC',
                    createdAt: '2026-08-29T19:00:00.000Z',
                    expiresAt: '2026-08-29T19:10:00.000Z',
                  },
                }, null, 2)}
                language="json"
                onCopy={() => handleCopy('checkout response', 'resp')}
                copied={copiedId === 'resp'}
              />
            </div>

            {/* Error table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Error Responses</h4>
              <div className="rounded-xl border border-neutral-800 overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-neutral-900/50 px-4 py-2 font-bold text-neutral-400 border-b border-neutral-800">
                  <span>HTTP</span><span>Meaning</span><span>Action</span>
                </div>
                {[
                  ['400', 'Bad Request', 'Missing or invalid amountEgp or senderHandle'],
                  ['401', 'Unauthorized', 'Invalid or missing API Key'],
                  ['402', 'Payment Required', 'Plan limit reached or subscription expired'],
                  ['429', 'Rate Limited', 'Max 60 requests/minute exceeded'],
                  ['500', 'Server Error', 'Unexpected failure — retry safely'],
                ].map(([code, meaning, action]) => (
                  <div key={code} className="grid grid-cols-3 px-4 py-2.5 border-b border-neutral-800/50 last:border-0">
                    <span className="font-mono font-bold text-indigo-300">{code}</span>
                    <span className="text-neutral-300">{meaning}</span>
                    <span className="text-neutral-500">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════ CHECK STATUS ═══════ */}
          <section id="check-status" className="scroll-mt-24 space-y-5">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 text-[10px] font-black text-blue-400 uppercase tracking-wider">GET</span>
              <h2 className="text-2xl font-black text-white">Check Status</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Get the current status of a checkout session. This endpoint is <strong className="text-white">public</strong> — no API key needed — safe for browser-side polling.
            </p>

            <CodeBlock
              code={`GET ${GATEWAY}/api/v1/checkout/status?sessionId=YOUR_SESSION_ID`}
              onCopy={() => handleCopy(`${GATEWAY}/api/v1/checkout/status?sessionId=`, 'status-ep')}
              copied={copiedId === 'status-ep'}
            />

            <ParamTable params={[
              { name: 'sessionId', type: 'string', required: true, description: 'The session ID returned from the Create Checkout response.' },
            ]} />

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Success Response (200)</h4>
              <CodeBlock
                code={JSON.stringify({
                  ok: true,
                  checkout: {
                    sessionId: 'cmt7qyzda000...',
                    businessName: client.businessName,
                    senderHandle: 'customer@instapay',
                    recipientHandle: client.instapayHandle || 'merchant@instapay',
                    amountEgp: 150,
                    currency: 'EGP',
                    status: 'CONFIRMED',
                    detectedRef: 'IPN notification reference',
                    detectedAt: '2026-08-29T19:02:15.000Z',
                    detectedAmountEgp: 150,
                    createdAt: '2026-08-29T19:00:00.000Z',
                    expiresAt: '2026-08-29T19:10:00.000Z',
                    note: 'Order #1234',
                  },
                }, null, 2)}
                language="json"
                onCopy={() => handleCopy('status response', 'status-resp')}
                copied={copiedId === 'status-resp'}
              />
            </div>
          </section>

          {/* ═══════ WEBHOOKS ═══════ */}
          <section id="webhook-overview" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Webhook Confirmations" subtitle="Real-time payment notifications delivered to your server" />

            <AlertBox type="tip">
              Always use the <strong>webhook</strong> for order fulfillment — don't rely solely on status polling. The gateway delivers webhooks at-least-once; make your fulfillment <strong>idempotent</strong>.
            </AlertBox>

            {/* Headers */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Webhook Headers</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['X-Instapay-Event-Id', 'Unique event ID — store it to deduplicate.'],
                  ['X-Instapay-Timestamp', 'Unix timestamp (seconds). Reject if stale.'],
                  ['X-Instapay-Signature-Version', 'Current value: v1.'],
                  ['X-Instapay-Signature', 'v1=HMAC_SHA256(timestamp.rawBody, secret).'],
                ].map(([name, desc]) => (
                  <div key={name} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
                    <code className="text-[11px] text-indigo-300 font-mono">{name}</code>
                    <p className="mt-1 text-[10px] text-neutral-500 leading-5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Webhook body */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Webhook Body</h4>
              <CodeBlock
                code={JSON.stringify({
                  id: '1b0b4ef3-6a5d-...',
                  created: 1787997600,
                  event: 'payment.confirmed',
                  clientId: client.id,
                  businessName: client.businessName,
                  transaction: {
                    sessionId: 'cmt7qyzda000...',
                    senderHandle: 'customer@instapay',
                    recipientHandle: client.instapayHandle || 'merchant@instapay',
                    amountEgp: 150,
                    detectedAmountEgp: 150,
                    currency: 'EGP',
                    status: 'CONFIRMED',
                    detectedRef: 'IPN notification reference',
                    detectedAt: '2026-08-29T19:02:00.000Z',
                    note: 'Order #1234',
                    createdAt: '2026-08-29T19:00:00.000Z',
                  },
                }, null, 2)}
                language="json"
                onCopy={() => handleCopy('webhook body', 'wb')}
                copied={copiedId === 'wb'}
              />
            </div>

            {/* Events */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Webhook Events</h4>
              <div className="rounded-xl border border-neutral-800 overflow-hidden text-xs">
                <div className="grid grid-cols-2 bg-neutral-900/50 px-4 py-2 font-bold text-neutral-400 border-b border-neutral-800">
                  <span>Event</span><span>Description</span>
                </div>
                {[
                  ['payment.confirmed', 'Payment matched and amount correct — fulfill the order'],
                  ['payment.underpaid', 'Payment detected but amount was less than expected — flag for review'],
                  ['subscription.payment_confirmed', 'Subscription plan payment confirmed'],
                ].map(([event, desc]) => (
                  <div key={event} className="grid grid-cols-2 px-4 py-2.5 border-b border-neutral-800/50 last:border-0">
                    <span className="font-mono text-emerald-300">{event}</span>
                    <span className="text-neutral-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════ SIGNATURE VERIFICATION ═══════ */}
          <section id="webhook-signature" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Signature Verification" subtitle="Verify every webhook before processing" />

            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 space-y-3">
              <h4 className="text-sm font-bold text-indigo-300">Signature Formula</h4>
              <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-4">
                <code className="text-sm font-mono text-indigo-300">
                  HMAC-SHA256( &quot;{'{timestamp}'}.{'{raw_json_body}'}&quot; , WEBHOOK_SECRET )
                </code>
              </div>
              <div className="space-y-2 text-xs text-neutral-400">
                <p><strong className="text-white">Step 1:</strong> Extract <code className="text-indigo-300">X-Instapay-Timestamp</code> and <code className="text-indigo-300">X-Instapay-Signature</code> from headers</p>
                <p><strong className="text-white">Step 2:</strong> Concatenate <code className="text-indigo-300">{`{timestamp}.{rawBody}`}</code> (dot-separated)</p>
                <p><strong className="text-white">Step 3:</strong> Compute HMAC-SHA256 using your webhook secret</p>
                <p><strong className="text-white">Step 4:</strong> Compare with provided signature using <strong>timing-safe equality</strong></p>
                <p><strong className="text-white">Step 5:</strong> Reject timestamps older than <strong>5 minutes</strong> to prevent replay attacks</p>
              </div>
            </div>
          </section>

          {/* ═══════ WEBHOOK CODE EXAMPLES ═══════ */}
          <section id="webhook-code" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Webhook Handler Examples" subtitle="Complete signature verification handlers for your backend" />

            <TabbedCode<WebhookLang>
              tabs={[
                { id: 'node', label: 'Node.js / Express' },
                { id: 'python', label: 'Python / Flask' },
                { id: 'php', label: 'PHP' },
              ]}
              activeTab={webhookTab}
              onTabChange={setWebhookTab}
              code={webhookSnippets[webhookTab]}
              onCopy={() => handleCopy(webhookSnippets[webhookTab], 'wh-code')}
              copied={copiedId === 'wh-code'}
            />
          </section>

          {/* ═══════ FRONTEND BUTTON ═══════ */}
          <section id="frontend-button" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Frontend Checkout Button" subtitle="Add a 'Pay with InstaPay' button to your cart page" />

            <CodeBlock
              code={`<!-- Add to your cart/checkout page -->
<button id="pay-instapay" onclick="startPayment()">
  Pay with InstaPay
</button>

<script>
async function startPayment() {
  const btn = document.getElementById('pay-instapay');
  btn.disabled = true;
  btn.textContent = 'Creating payment...';

  // Call YOUR backend (which calls the gateway API)
  const res = await fetch('/api/create-order', { method: 'POST' });
  const { checkoutUrl, sessionId } = await res.json();

  // Option A: Redirect to hosted checkout page
  window.location.href = checkoutUrl;

  // Option B: Poll status in background
  // const interval = setInterval(async () => {
  //   const s = await fetch(\`/api/order-status?sid=\${sessionId}\`);
  //   const d = await s.json();
  //   if (d.status === 'CONFIRMED') {
  //     clearInterval(interval);
  //     window.location.href = '/order-success';
  //   } else if (d.status === 'EXPIRED') {
  //     clearInterval(interval);
  //     btn.disabled = false;
  //     btn.textContent = 'Pay with InstaPay';
  //     alert('Payment expired. Please try again.');
  //   }
  // }, 3000);
}
</script>`}
              language="html"
              onCopy={() => handleCopy('frontend code', 'fe')}
              copied={copiedId === 'fe'}
            />
          </section>

          {/* ═══════ BEST PRACTICES ═══════ */}
          <section id="best-practices" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Best Practices" subtitle="Security and operational guidelines" />

            <div className="grid gap-3 sm:grid-cols-2">
              <PracticeCard icon={<Webhook className="h-4 w-4" />} title="Use Webhooks for Fulfillment" color="emerald">
                Don't rely on status polling alone. The webhook is the authoritative confirmation signal.
              </PracticeCard>
              <PracticeCard icon={<Shield className="h-4 w-4" />} title="Always Verify Signatures" color="indigo">
                Use timing-safe comparison. Reject stale timestamps ({'>'} 5 minutes). Log invalid attempts.
              </PracticeCard>
              <PracticeCard icon={<RefreshCw className="h-4 w-4" />} title="Make Fulfillment Idempotent" color="violet">
                The gateway delivers webhooks at-least-once. Deduplicate by event ID or session ID.
              </PracticeCard>
              <PracticeCard icon={<Key className="h-4 w-4" />} title="Protect Your Keys" color="amber">
                Keep API Key and Webhook Secret on the server only. Regenerate immediately if exposed.
              </PracticeCard>
              <PracticeCard icon={<Smartphone className="h-4 w-4" />} title="Monitor the Detector APK" color="cyan">
                Ensure notification access is granted, battery optimization is disabled, and the APK stays online.
              </PracticeCard>
              <PracticeCard icon={<Terminal className="h-4 w-4" />} title="Use the note Field" color="pink">
                Pass your order ID in the <code className="text-xs bg-neutral-900 px-1 rounded">note</code> field for easy reconciliation.
              </PracticeCard>
            </div>
          </section>

          {/* ═══════ RATE LIMITS ═══════ */}
          <section id="rate-limits" className="scroll-mt-24 space-y-5">
            <SectionHeader title="Rate Limits & Plan Quotas" subtitle="Current limits for your account" />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">API Rate Limit</div>
                <div className="mt-2 text-2xl font-black text-white">60</div>
                <div className="text-xs text-neutral-500">requests / minute</div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Current Plan</div>
                <div className="mt-2 text-2xl font-black text-violet-300">{client.subscriptionPlan.replaceAll('_', ' ')}</div>
                <div className="text-xs text-neutral-500">{client.isFreeTrial ? 'Free trial' : 'Active subscription'}</div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Transaction Quota</div>
                <div className="mt-2 text-2xl font-black text-white">{client.txCount} / {client.txLimit}</div>
                <div className="text-xs text-neutral-500">confirmed this period</div>
              </div>
            </div>

            {client.txCount >= client.txLimit && (
              <AlertBox type="warning">
                Your transaction quota is <strong>fully used</strong>. <Link href="/dashboard" className="underline text-amber-300 hover:text-amber-200">Upgrade your plan</Link> from the Dashboard Billing tab.
              </AlertBox>
            )}

            {/* Retry policy */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Webhook Retry Policy</h4>
              <p className="text-xs text-neutral-400">
                A webhook delivery succeeds when your endpoint returns any 2xx response within 10 seconds. Failed deliveries are retried with exponential backoff:
              </p>
              <div className="grid gap-3 grid-cols-5 text-center text-xs">
                {[
                  { label: 'Initial', time: 'Immediate', active: true },
                  { label: 'Retry 1', time: '~5 min', active: true },
                  { label: 'Retry 2', time: '~27 min', active: true },
                  { label: 'Retry 3', time: '~81 min', active: true },
                  { label: 'Retry 4', time: '~243 min', active: false },
                ].map((r) => (
                  <div key={r.label} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
                    <div className="font-bold text-white">{r.label}</div>
                    <div className={`font-mono mt-1 ${r.active ? 'text-indigo-400' : 'text-red-400'}`}>{r.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════ QUICK START SUMMARY ═══════ */}
          <section className="scroll-mt-24 space-y-4 pb-8">
            <div className="rounded-2xl border-2 border-violet-500/30 bg-gradient-to-br from-violet-950/20 to-indigo-950/20 p-6 sm:p-8">
              <h2 className="text-xl font-black text-white mb-4">Quick-Start Summary</h2>
              <div className="space-y-3 text-sm">
                {[
                  { step: '1', text: 'Dashboard → Set handle, payment URL, webhook URL', icon: '⚙️' },
                  { step: '2', text: `Backend → POST /api/v1/checkout/create with API Key`, icon: '🔌' },
                  { step: '3', text: 'Frontend → Redirect customer to checkoutUrl or deepLinkUrl', icon: '🖥️' },
                  { step: '4', text: 'Customer → Pays via official InstaPay app', icon: '💳' },
                  { step: '5', text: 'Detector → APK auto-detects the payment notification', icon: '📱' },
                  { step: '6', text: 'Gateway → Matches payment, sends webhook to your store', icon: '🔄' },
                  { step: '7', text: 'Your Store → Webhook handler verifies signature, fulfills order ✅', icon: '✅' },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-3 text-neutral-300">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-base border border-violet-500/20">{s.icon}</span>
                    <span><strong className="text-white">Step {s.step}:</strong> {s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-900 py-6 bg-neutral-950 text-center text-xs text-neutral-600">
        InstaPay Gateway · Integration Guide · {client.businessName}
      </footer>
    </div>
  )
}

/* ═══════════════════════ SUB-COMPONENTS ═══════════════════════ */

function NavGroup({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
        <span className="text-violet-400">{icon}</span> {title}
      </h4>
      <ul className="mt-2.5 space-y-1.5 pl-6">{children}</ul>
    </div>
  )
}

function NavLink({ href, children, badge, badgeColor }: { href: string; children: React.ReactNode; badge?: string; badgeColor?: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
  }
  return (
    <li>
      <a href={href} className="flex items-center gap-2 text-neutral-400 hover:text-violet-300 transition-colors">
        {badge && <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase ${colors[badgeColor || 'emerald']}`}>{badge}</span>}
        {children}
      </a>
    </li>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <p className="text-sm text-neutral-400">{subtitle}</p>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5 space-y-2 hover:border-violet-500/30 transition-colors">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
        {icon}
      </span>
      <h3 className="font-bold text-white text-sm">{title}</h3>
      <p className="text-[11px] text-neutral-500 leading-5">{description}</p>
    </div>
  )
}

function FlowNode({ icon, label, sublabel, color, pulse }: { icon: React.ReactNode; label: string; sublabel: string; color: string; pulse?: boolean }) {
  const colors: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    violet: { bg: 'bg-violet-500/5', border: 'border-violet-500/30', icon: 'bg-violet-500/20 text-violet-400', text: 'text-violet-300' },
    indigo: { bg: 'bg-indigo-500/5', border: 'border-indigo-500/30', icon: 'bg-indigo-500/20 text-indigo-400', text: 'text-indigo-300' },
    amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', icon: 'bg-amber-500/20 text-amber-400', text: 'text-amber-300' },
    emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', icon: 'bg-emerald-500/20 text-emerald-400', text: 'text-emerald-300' },
  }
  const c = colors[color] || colors.violet
  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-2xl border ${c.border} ${c.bg} px-3 py-3 w-[136px] shrink-0 ${pulse ? 'shadow-lg shadow-violet-950/20' : ''}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.icon}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-black text-center leading-tight ${c.text}`}>{label}</span>
      <span className="text-[8px] text-neutral-500 text-center leading-tight">{sublabel}</span>
    </div>
  )
}

function FlowArrow({ label, sublabel, direction, color, dashed }: { label: string; sublabel: string; direction: 'left' | 'right'; color?: string; dashed?: boolean }) {
  const arrowColor = color === 'amber' ? 'text-amber-400' : color === 'emerald' ? 'text-emerald-400' : 'text-violet-400'
  const lineColor = color === 'amber' ? 'border-amber-500/40' : color === 'emerald' ? 'border-emerald-500/40' : 'border-violet-500/40'
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-[100px] px-1">
      <div className="text-[8px] text-neutral-400 font-bold text-center leading-tight">{label}</div>
      <div className="flex items-center w-full gap-0">
        {direction === 'left' && <ArrowLeft className={`h-3 w-3 shrink-0 ${arrowColor}`} />}
        <div className={`flex-1 border-t ${dashed ? 'border-dashed' : ''} ${lineColor}`} />
        {direction === 'right' && <ArrowRight className={`h-3 w-3 shrink-0 ${arrowColor}`} />}
      </div>
      <div className="text-[7px] text-neutral-600 text-center leading-tight">{sublabel}</div>
    </div>
  )
}

function StatusCard({ status, description, color }: { status: string; description: string; color: string }) {
  const colors: Record<string, string> = {
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
    neutral: 'border-neutral-700 bg-neutral-900/30 text-neutral-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-300',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="font-mono text-xs font-black">{status}</div>
      <div className="mt-1 text-[10px] leading-4 text-neutral-500">{description}</div>
    </div>
  )
}

function CredentialRow({ label, value, masked, description, onCopy, copied }: { label: string; value: string | null; masked: string; description: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-800/50 pb-3 last:border-0 last:pb-0">
      <div className="space-y-0.5">
        <span className="text-neutral-300 font-semibold">{label}</span>
        <p className="text-[10px] text-neutral-600">{description}</p>
      </div>
      <div className="flex items-center gap-2 font-mono text-neutral-300">
        <span className="truncate rounded-lg border border-neutral-800 bg-neutral-900/70 px-2 py-1 text-[11px] select-all max-w-[220px]">
          {masked}
        </span>
        <button onClick={onCopy} disabled={!value} className="text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-30">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

function CodeBlock({ code, language, onCopy, copied }: { code: string; language?: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
      <pre className="p-4 text-[11px] font-mono text-neutral-300 overflow-x-auto leading-relaxed max-h-[400px]">
        <code>{code}</code>
      </pre>
      <button
        onClick={onCopy}
        className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function TabbedCode<T extends string>({ tabs, activeTab, onTabChange, code, onCopy, copied }: {
  tabs: Array<{ id: T; label: string }>
  activeTab: T
  onTabChange: (tab: T) => void
  code: string
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
      <div className="flex border-b border-neutral-800 bg-neutral-900/30 px-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="p-4 text-[11px] font-mono text-neutral-300 overflow-x-auto leading-relaxed max-h-[450px]">
          <code>{code}</code>
        </pre>
        <button
          onClick={onCopy}
          className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function ParamTable({ params }: { params: Array<{ name: string; type: string; required: boolean; description: string }> }) {
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden text-xs">
      <div className="grid grid-cols-4 bg-neutral-900/50 px-4 py-2 font-bold text-neutral-400 border-b border-neutral-800">
        <span>Field</span><span>Type</span><span>Required</span><span>Description</span>
      </div>
      {params.map((p) => (
        <div key={p.name} className="grid grid-cols-4 px-4 py-2.5 border-b border-neutral-800/50 last:border-0">
          <span className="font-mono text-indigo-300">{p.name}</span>
          <span className="text-neutral-500 font-mono">{p.type}</span>
          <span className={p.required ? 'text-emerald-400 font-bold' : 'text-neutral-600'}>
            {p.required ? 'Yes' : 'No'}
          </span>
          <span className="text-neutral-400">{p.description}</span>
        </div>
      ))}
    </div>
  )
}

function AlertBox({ type, children }: { type: 'warning' | 'important' | 'tip'; children: React.ReactNode }) {
  const styles = {
    warning: { border: 'border-amber-500/20', bg: 'bg-amber-500/5', icon: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />, text: 'text-amber-100' },
    important: { border: 'border-red-500/20', bg: 'bg-red-500/5', icon: <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />, text: 'text-red-100' },
    tip: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', icon: <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />, text: 'text-emerald-100' },
  }
  const s = styles[type]
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} p-4 text-xs leading-6 ${s.text}`}>
      {s.icon}
      <div>{children}</div>
    </div>
  )
}

function PracticeCard({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-500/20 text-emerald-400',
    indigo: 'border-indigo-500/20 text-indigo-400',
    violet: 'border-violet-500/20 text-violet-400',
    amber: 'border-amber-500/20 text-amber-400',
    cyan: 'border-cyan-500/20 text-cyan-400',
    pink: 'border-pink-500/20 text-pink-400',
  }
  const c = colors[color] || colors.violet
  const [borderClass, textClass] = c.split(' ')
  return (
    <div className={`rounded-xl border ${borderClass} bg-neutral-900/30 p-4 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={textClass}>{icon}</span>
        <h4 className="text-xs font-bold text-white">{title}</h4>
      </div>
      <p className="text-[10px] text-neutral-500 leading-5">{children}</p>
    </div>
  )
}
