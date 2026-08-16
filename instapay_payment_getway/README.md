# InstaPay Detector — Payment Gateway

A payment gateway for InstaPay Egypt that auto-confirms client payments by detecting InstaPay's "You have received X EGP from `<handle>`@instapay" push notifications via a companion Android app.

## Architecture

```
Client (web) → enters username + amount → Gateway creates PENDING checkout
Client opens real InstaPay APK → sends X EGP to mohammedshabana77@instapay
Merchant's Android phone receives InstaPay notification
InstaPay Detector (Android app) → NotificationListenerService parses it
Detector POSTs to /api/webhooks/instapay → Gateway matches PENDING checkout → CONFIRMED
Client polls /api/checkout/[id] OR receives WebSocket push → sees "confirmed!"
```

## What's in this repo

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js 16 app (pages + API routes) |
| `src/app/api/checkout/` | Create + poll pending checkouts |
| `src/app/api/webhooks/instapay/` | Receive detection reports from Android app |
| `src/app/api/dashboard/` | Merchant dashboard stats |
| `src/app/api/transactions/` | Paginated + searchable transaction list |
| `src/app/api/stats/chart/` | 30-day revenue series for charts |
| `src/components/` | Checkout form, waiting screen (with QR + WebSocket), merchant dashboard |
| `src/lib/merchant.ts` | Merchant config + InstaPay deep link builder |
| `mini-services/checkout-notifier/` | socket.io WebSocket service (separate port) |
| `prisma/schema.prisma` | SQLite schema (local dev) |
| `prisma/schema.production.prisma` | PostgreSQL schema (Render/production) |
| `render.yaml` | Render Blueprint for one-click deploy |

## Quick start (local dev)

```bash
# Install dependencies
npm install

# Set up the database
npm run db:push

# Set env vars (copy .env.example to .env and edit)
cp .env.example .env

# Run the dev server (starts Next.js + the notifier mini-service)
npm run dev
```

Open http://localhost:3000

## Environment variables

See `.env.example` for all variables. The most important:

- `DATABASE_URL` — SQLite file path (local) or PostgreSQL URL (Render)
- `DETECT_TOKEN` — shared secret between the Android app and the webhook
- `MERCHANT_HANDLE` — your InstaPay handle (e.g. `mohammedshabana77@instapay`)
- `NOTIFIER_URL` — URL of the WebSocket notifier service
- `NEXT_PUBLIC_NOTIFIER_URL` — same, exposed to the browser

## Deploy to Render

See `RENDER-DEPLOYMENT-GUIDE.md` (in the download folder) for step-by-step instructions, or use the included `render.yaml` Blueprint for one-click deploy.

## The Android app

The companion Android app (InstaPay Detector) is in a separate repo: `instapay-detector-android`. It runs on the merchant's phone, captures InstaPay notifications, and POSTs to this gateway's webhook.

## Disclaimer

This is a sandbox/demo project. It does not move real money, does not connect to the official InstaPay backend, and does not modify the InstaPay app. It only reads notifications that the official InstaPay app already posts on the merchant's device. Do not use it to deceive any person about a payment's status.
