import { NextResponse } from 'next/server'

export async function GET() {
  const snippets = {
    curl: `curl -X POST https://your-gateway.example.com/api/v1/checkout/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1004"
  }'`,

    javascript: `// Create payment checkout
const response = await fetch('https://your-gateway.example.com/api/v1/checkout/create', {
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
const { checkout } = await response.json();
console.log('Payment Deep Link:', checkout.deepLinkUrl);

// Poll status
const statusRes = await fetch(\`https://your-gateway.example.com/api/v1/checkout/status?sessionId=\${checkout.sessionId}\`);
const statusData = await statusRes.json();
console.log('Status:', statusData.checkout.status);`,

    python: `import requests

# 1. Create checkout
url = "https://your-gateway.example.com/api/v1/checkout/create"
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
checkout = res["checkout"]
print(f"Deep Link: {checkout['deepLinkUrl']}")

# 2. Check Status (public endpoint, no auth header needed)
session_id = checkout["sessionId"]
status_res = requests.get(f"https://your-gateway.example.com/api/v1/checkout/status?sessionId={session_id}").json()
print(f"Status: {status_res['checkout']['status']}")`,

    php: `<?php
$ch = curl_init("https://your-gateway.example.com/api/v1/checkout/create");
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

$checkout = $response['checkout'];
echo "Status: " . $checkout['status'] . "\n";
?>`,

    nodeWebhook: `// Node.js Express Webhook Handler (on your own merchant server)
const crypto = require('crypto')
const express = require('express')
const app = express()

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  }
}))

const WEBHOOK_SECRET = process.env.INSTAPAY_WEBHOOK_SECRET

app.post('/webhook/instapay', (req, res) => {
  const signatureHeader = req.headers['x-instapay-signature']; // v1=<hex>
  const timestamp = req.headers['x-instapay-timestamp'];
  const eventId = req.headers['x-instapay-event-id'];
  const { event, transaction } = req.body;

  if (!signatureHeader || !timestamp || !eventId) {
    return res.status(401).json({ error: 'Missing InstaPay signature headers' });
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    return res.status(400).json({ error: 'Expired webhook timestamp' });
  }

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(\`\${timestamp}.\${req.rawBody}\`)
    .digest('hex');

  const provided = String(signatureHeader).replace(/^v1=/, '').trim();
  const verified =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!verified) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Idempotency: store eventId or transaction.sessionId in your database.
  
  if (event === 'payment.confirmed') {
    const { sessionId, amountEgp, senderHandle, detectedRef } = transaction;
    console.log(\`Payment confirmed! \${amountEgp} EGP from \${senderHandle} (Ref: \${detectedRef})\`);
    // Fulfill order in your database.
  } else if (event === 'payment.underpaid') {
    // Keep order pending/manual review. detectedAmountEgp is lower than amountEgp.
  } else if (event === 'subscription.payment_confirmed') {
    // Optional: mirror billing state in your own system.
  }

  res.status(200).json({ received: true });
});`
  }

  return NextResponse.json({ ok: true, snippets })
}
