'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Code,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Key,
  Layers,
  Lock,
  RefreshCw,
  Terminal,
  Webhook
} from 'lucide-react'
import { Button } from '@/components/ui/button'


interface CodeSnippets {
  curl: string
  js: string
  python: string
  php: string
}

const snippets: CodeSnippets = {
  curl: `curl -X POST https://instapay-ruddy.vercel.app/api/v1/checkout/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1004"
  }'`,
  js: `// Create payment checkout
const response = await fetch('https://instapay-ruddy.vercel.app/api/v1/checkout/create', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    amountEgp: 50.00,
    senderHandle: 'customer@instapay',
    note: 'Order #1004'
  })
});
const { ok, checkout, error } = await response.json();
if (!ok) {
  console.error('Failed to create checkout:', error);
} else {
  console.log('Session ID:', checkout.sessionId);
  console.log('Instapay QR Deep Link URL:', checkout.deepLinkUrl);
}`,
  python: `import requests

url = "https://instapay-ruddy.vercel.app/api/v1/checkout/create"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1004"
}

res = requests.post(url, json=payload, headers=headers).json()
if res.get("ok"):
    checkout = res["checkout"]
    print(f"Checkout Session Created: {checkout['sessionId']}")
    print(f"Deep Link: {checkout['deepLinkUrl']}")
else:
    print(f"Error: {res.get('error')}")`,
  php: `<?php
$ch = curl_init("https://instapay-ruddy.vercel.app/api/v1/checkout/create");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'amountEgp' => 50.00,
    'senderHandle' => 'customer@instapay',
    'note' => 'Order #1004'
]));
$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response['ok']) {
    $checkout = $response['checkout'];
    echo "Session ID: " . $checkout['sessionId'] . "\\n";
    echo "Deep Link: " . $checkout['deepLinkUrl'] . "\\n";
} else {
    echo "Error: " . $response['error'] . "\\n";
}
?>`
}

const expressSnippet = `// Node.js Express Webhook Signature Validation Example
import crypto from 'crypto'
import express from 'express'

const app = express()
app.use(express.json())

const WEBHOOK_SECRET = 'your_merchant_webhook_secret'

app.post('/api/webhooks/payment', (req, res) => {
  const signatureHeader = req.headers['x-instapay-signature'] // format: v1=<signature>
  const timestamp = req.headers['x-instapay-timestamp']
  
  if (!signatureHeader || !timestamp) {
    return res.status(401).json({ error: 'Missing signature headers' })
  }

  // Prevent replay attacks: reject timestamps older than 5 minutes
  const timeDifference = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (timeDifference > 300) {
    return res.status(400).json({ error: 'Timestamp expired' })
  }

  const rawJson = JSON.stringify(req.body)
  const baseString = \`\${timestamp}.\${rawJson}\`
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(baseString)
    .digest('hex')

  const providedSignature = signatureHeader.replace(/^v1=/, '').trim()

  // Time-safe equality check
  const verified = crypto.timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature)
  )

  if (!verified) {
    return res.status(401).json({ error: 'Invalid webhook signature' })
  }

  const { event, transaction } = req.body
  if (event === 'payment.confirmed') {
    const { sessionId, amountEgp, senderHandle, detectedRef } = transaction
    console.log(\`Success: Received \${amountEgp} EGP from \${senderHandle} (Ref: \${detectedRef})\`)
    // Fulfill the order or upgrade subscription here
  }

  res.status(200).json({ ok: true })
})`

export default function DocsPage() {
  const [selectedSnippetTab, setSelectedSnippetTab] = useState<keyof CodeSnippets>('curl')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg text-indigo-400">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">IPN</span>
              InstaPay Gateway
            </Link>
            <span className="hidden h-5 w-px bg-slate-800 sm:inline-block"></span>
            <span className="hidden text-xs text-slate-500 sm:inline-block">Merchant Documentation v2.0</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" className="h-9 border-slate-800 hover:bg-slate-900 text-slate-300">
                Merchant Console
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Navigation Sidebar */}
          <aside className="hidden lg:col-span-3 lg:block">
            <nav className="sticky top-24 space-y-6">
              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> Getting Started
                </h4>
                <ul className="mt-3 space-y-2.5 pl-6 text-sm text-slate-400">
                  <li>
                    <a href="#overview" className="hover:text-indigo-400 transition-colors">Overview</a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="hover:text-indigo-400 transition-colors">How it works</a>
                  </li>
                  <li>
                    <a href="#auth" className="hover:text-indigo-400 transition-colors">Authentication</a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Terminal className="h-3.5 w-3.5 text-indigo-400" /> API Reference
                </h4>
                <ul className="mt-3 space-y-2.5 pl-6 text-sm text-slate-400">
                  <li>
                    <a href="#create-checkout" className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded">POST</span> Create Checkout
                    </a>
                  </li>
                  <li>
                    <a href="#check-status" className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded">GET</span> Check Status
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Webhook className="h-3.5 w-3.5 text-indigo-400" /> Webhook Integration
                </h4>
                <ul className="mt-3 space-y-2.5 pl-6 text-sm text-slate-400">
                  <li>
                    <a href="#webhooks" className="hover:text-indigo-400 transition-colors">Webhooks Overview</a>
                  </li>
                  <li>
                    <a href="#signature" className="hover:text-indigo-400 transition-colors">Signature Validation</a>
                  </li>
                  <li>
                    <a href="#retry-policy" className="hover:text-indigo-400 transition-colors">Retry Policy</a>
                  </li>
                </ul>
              </div>
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-9 space-y-16">
            {/* Overview Section */}
            <section id="overview" className="scroll-mt-24 space-y-4">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                InstaPay Gateway API
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed">
                Connect your website or mobile application to the Instant Payment Network (IPN) of Egypt. Create checkouts, poll payment status, and receive real-time webhook callback notifications instantly.
              </p>

              <div className="grid gap-6 sm:grid-cols-3 mt-8">
                <div className="p-5 bg-slate-900/50 border border-slate-900 rounded-xl space-y-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Layers className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-white">Simple API</h3>
                  <p className="text-xs text-slate-400">Generate inline payments and QR codes with a single server-to-server POST request.</p>
                </div>
                <div className="p-5 bg-slate-900/50 border border-slate-900 rounded-xl space-y-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Globe className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-white">Webhook Delivery</h3>
                  <p className="text-xs text-slate-400">Receive instantaneous notifications at your backend server when transfers are detected.</p>
                </div>
                <div className="p-5 bg-slate-900/50 border border-slate-900 rounded-xl space-y-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Lock className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-white">HMAC Signed</h3>
                  <p className="text-xs text-slate-400">Every webhook payload carries a timestamped SHA256 signature for complete request security.</p>
                </div>
              </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">How it works</h2>
              <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-xl space-y-6">
                <div className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">1</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Create Checkout Session</h4>
                    <p className="text-slate-400 text-xs mt-1">Your server triggers the Checkout API. The gateway responds with a session ID, transaction details, and a dynamic InstaPay payment URL.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">2</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Customer Pays on App</h4>
                    <p className="text-slate-400 text-xs mt-1">The customer scans the QR code or opens the InstaPay link on their mobile device and initiates the transfer from their local bank account.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">3</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Automatic Detection & Webhook Callback</h4>
                    <p className="text-slate-400 text-xs mt-1">The merchant's Android Detector APK parses the incoming bank notification on their device, matches it, reports it to the gateway, and triggers the webhook callback to your server.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Authentication Section */}
            <section id="auth" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">Authentication</h2>
              <p className="text-slate-400 text-sm">
                Authenticate server-side API requests by providing your merchant API Key inside the standard HTTP `Authorization` header. API Keys are generated in your dashboard Developer settings under the **Developers** tab.
              </p>
              <div className="p-4 bg-slate-950 border border-slate-900 rounded-lg flex items-center justify-between">
                <code className="text-xs text-indigo-400">Authorization: Bearer ipk_live_xxxxxxxxxxxxxxxxxxxxxxxx</code>
                <button
                  onClick={() => handleCopy('Authorization: Bearer ipk_live_xxxxxxxxxxxxxxxxxxxxxxxx', 'auth')}
                  className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded"
                >
                  {copiedId === 'auth' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </section>

            {/* API References */}
            <section id="create-checkout" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md">POST</span>
                <h2 className="text-2xl font-bold text-white">Create Checkout</h2>
              </div>
              <p className="text-slate-400 text-sm">
                Creates a new checkout session. It returns the session parameters, the deep link URL, and transaction timestamps.
              </p>
              <div className="p-3 bg-slate-950 border border-slate-900 rounded-md">
                <code className="text-xs text-slate-300">POST /api/v1/checkout/create</code>
              </div>

              {/* Snippets with Tabs */}
              <div className="border border-slate-900 rounded-xl bg-slate-950 overflow-hidden">
                <div className="flex border-b border-slate-900 bg-slate-900/30 px-2 overflow-x-auto">
                  {(Object.keys(snippets) as Array<keyof CodeSnippets>).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedSnippetTab(tab)}
                      className={`px-4 py-3 text-xs font-semibold transition-colors border-b-2 uppercase ${
                        selectedSnippetTab === tab
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="relative p-5">
                  <pre className="text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
                    {snippets[selectedSnippetTab]}
                  </pre>
                  <button
                    onClick={() => handleCopy(snippets[selectedSnippetTab], 'snippet')}
                    className="absolute right-4 top-4 p-1.5 bg-slate-900/80 hover:bg-slate-900 text-slate-400 hover:text-white rounded border border-slate-800"
                  >
                    {copiedId === 'snippet' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Params list */}
              <div className="space-y-4">
                <h4 className="font-semibold text-white text-sm">Request Body parameters</h4>
                <div className="border border-slate-900 rounded-xl overflow-hidden text-sm">
                  <div className="grid grid-cols-4 bg-slate-900/40 p-3 border-b border-slate-900 text-xs font-semibold text-slate-400">
                    <div>Field</div>
                    <div>Type</div>
                    <div>Required</div>
                    <div>Description</div>
                  </div>
                  <div className="grid grid-cols-4 p-3 border-b border-slate-900">
                    <div className="font-mono text-indigo-400">amountEgp</div>
                    <div className="text-slate-500 font-mono">number</div>
                    <div className="text-emerald-500">Yes</div>
                    <div className="text-slate-400 text-xs">Amount in Egyptian Pounds. Minimum: 1.00 EGP.</div>
                  </div>
                  <div className="grid grid-cols-4 p-3 border-b border-slate-900">
                    <div className="font-mono text-indigo-400">senderHandle</div>
                    <div className="text-slate-500 font-mono">string</div>
                    <div className="text-emerald-500">Yes</div>
                    <div className="text-slate-400 text-xs">Customer handle (e.g. username@instapay).</div>
                  </div>
                  <div className="grid grid-cols-4 p-3">
                    <div className="font-mono text-indigo-400">note</div>
                    <div className="text-slate-500 font-mono">string</div>
                    <div className="text-slate-500">No</div>
                    <div className="text-slate-400 text-xs">Order details (max 200 chars).</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Check Status Section */}
            <section id="check-status" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-md">GET</span>
                <h2 className="text-2xl font-bold text-white">Check Status</h2>
              </div>
              <p className="text-slate-400 text-sm">
                Get the status of an existing checkout session. This endpoint is public and does not require credentials, making it safe for browser polling.
              </p>
              <div className="p-3 bg-slate-950 border border-slate-900 rounded-md">
                <code className="text-xs text-slate-300">GET /api/v1/checkout/status?sessionId=YOUR_SESSION_ID</code>
              </div>

              {/* Params list */}
              <div className="space-y-4">
                <h4 className="font-semibold text-white text-sm">Query parameters</h4>
                <div className="border border-slate-900 rounded-xl overflow-hidden text-sm">
                  <div className="grid grid-cols-4 bg-slate-900/40 p-3 border-b border-slate-900 text-xs font-semibold text-slate-400">
                    <div>Parameter</div>
                    <div>Type</div>
                    <div>Required</div>
                    <div>Description</div>
                  </div>
                  <div className="grid grid-cols-4 p-3">
                    <div className="font-mono text-indigo-400">sessionId</div>
                    <div className="text-slate-500 font-mono">string</div>
                    <div className="text-emerald-500">Yes</div>
                    <div className="text-slate-400 text-xs">The ID returned when creating checkout.</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Webhooks Section */}
            <section id="webhooks" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">Webhook callbacks</h2>
              <p className="text-slate-400 text-sm">
                Configure your public webhook URL in the merchant console. The gateway will post payload updates when checkouts are completed or underpaid.
              </p>
              <div className="p-5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl space-y-2">
                <h4 className="font-semibold text-indigo-400 text-sm">Webhook Callback Event Payload</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Webhooks are delivered as `POST` requests. The payload includes the original transaction data, the event action (`payment.confirmed` or `payment.underpaid`), and the detector reference ID.
                </p>
              </div>
            </section>

            {/* Webhook Signature Validation */}
            <section id="signature" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold text-white">Signature validation</h2>
              <p className="text-slate-400 text-sm">
                Verify webhook signatures to ensure that payloads are genuine. Each request contains headers to construct and verify the HMAC-SHA256 signature.
              </p>
              <div className="space-y-3 text-sm pl-4 border-l-2 border-indigo-500">
                <div className="text-slate-300"><code className="text-indigo-400 font-mono">X-Instapay-Timestamp</code>: {"Request timestamp. Reject requests older than 5 minutes to prevent replay attacks."}</div>
                <div className="text-slate-300"><code className="text-indigo-400 font-mono">X-Instapay-Signature</code>: {"Formatted as v1=<signature>. Computes as HMAC-SHA256(timestamp + \".\" + rawBody, webhookSecret)."}</div>
              </div>

              {/* Express JS Signature Verification Snippet */}
              <div className="border border-slate-900 rounded-xl bg-slate-950 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-900 bg-slate-900/30 px-4 py-3 text-xs font-semibold text-indigo-400 font-mono">
                  EXPRESS WEBHOOK HANDLER
                  <button
                    onClick={() => handleCopy(expressSnippet, 'express')}
                    className="p-1 bg-slate-900/80 hover:bg-slate-900 text-slate-400 hover:text-white rounded border border-slate-800"
                  >
                    {copiedId === 'express' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="p-5">
                  <pre className="text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed max-h-[450px]">
                    {expressSnippet}
                  </pre>
                </div>
              </div>
            </section>

            {/* Webhook Retry Policy */}
            <section id="retry-policy" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">Retry policy</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                If your endpoint fails to respond with a `200 OK` status, the gateway schedules retries with exponential backoff. Retries occur up to 5 times over several hours.
              </p>
              <div className="grid gap-4 sm:grid-cols-5 text-center text-xs mt-4">
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-lg">
                  <div className="font-semibold text-white">Attempt 1</div>
                  <div className="text-indigo-400 font-mono mt-1">3 mins</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-lg">
                  <div className="font-semibold text-white">Attempt 2</div>
                  <div className="text-indigo-400 font-mono mt-1">9 mins</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-lg">
                  <div className="font-semibold text-white">Attempt 3</div>
                  <div className="text-indigo-400 font-mono mt-1">27 mins</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-lg">
                  <div className="font-semibold text-white">Attempt 4</div>
                  <div className="text-indigo-400 font-mono mt-1">81 mins</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-lg">
                  <div className="font-semibold text-white">Attempt 5</div>
                  <div className="text-rose-400 font-mono mt-1">243 mins</div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-24 border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} InstaPay Gateway. All rights reserved.</p>
        <p className="mt-1">For merchant support, please consult the dashboard operations panel.</p>
      </footer>
    </div>
  )
}
