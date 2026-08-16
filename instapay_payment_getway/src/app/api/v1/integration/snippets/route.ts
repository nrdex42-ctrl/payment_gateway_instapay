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

    nodeWebhook: `// Node.js Express Webhook Handler (on your own client server)
// Gateway calls this endpoint with X-Instapay-Signature header for validation
app.post('/webhook/instapay', (req, res) => {
  const signature = req.headers['x-instapay-signature'];
  const { event, transaction } = req.body;
  
  if (event === 'payment.confirmed') {
    const { sessionId, amountEgp, senderHandle, detectedRef } = transaction;
    console.log(\`Payment confirmed! \${amountEgp} EGP from \${senderHandle} (Ref: \${detectedRef})\`);
    
    // Validate signature with your webhookSecret to ensure the request is from the gateway.
    // Fulfill order in your database
  }
  res.status(200).json({ received: true });
});`
  }

  return NextResponse.json({ ok: true, snippets })
}
