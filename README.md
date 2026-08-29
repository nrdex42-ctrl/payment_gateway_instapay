# InstaPay Egypt Payment Gateway

Production-oriented payment gateway for Egyptian merchants using InstaPay payment links, automated Android notification detection, merchant dashboards, admin operations tooling, subscription billing, signed webhooks, and Android companion APKs.

The system does not integrate with the official InstaPay backend. Customers still pay through the official InstaPay app. Confirmation is driven by the merchant receiving phone: the Detector APK reads official InstaPay receipt notifications, parses the sender and amount, and reports the event to the gateway.

## Repository layout

| Path | Purpose |
| --- | --- |
| `instapay_payment_gateway/` | Next.js web app, API routes, Prisma schema, merchant dashboard, admin portal, checkout pages |
| `instapay-detector-android/app/` | Merchant Detector APK for Android notification detection and merchant-side app notifications |
| `instapay-detector-android/admin/` | Admin APK for owner operations from Android |
| `apks/` | Built release APKs copied for distribution/install testing |
| `instapay_payment_gateway/docs/OPERATIONS.md` | Operational notes for migrations, plans, webhook requirements, and hardening rollout |
| `instapay_payment_gateway/mini-services/checkout-notifier/` | Optional Socket.IO notifier service for real-time checkout updates |

## Current production URLs

- Public gateway: `https://instapay-ruddy.vercel.app`
- Merchant dashboard: `https://instapay-ruddy.vercel.app/dashboard`
- Merchant registration: `https://instapay-ruddy.vercel.app/register`
- Merchant login: `https://instapay-ruddy.vercel.app/login`
- Admin portal path: configured by `NEXT_PUBLIC_ADMIN_PORTAL_PATH` when set; otherwise use `/portal/[hash]`

Do not commit production `.env` files or access tokens. Use Vercel/Supabase secret management for production values.

## High-level architecture

```text
Merchant backend
  │
  │ 1. POST /api/v1/checkout/create with merchant apiKey
  ▼
Next.js Gateway API
  │
  │ 2. Creates PENDING transaction and returns hosted checkout URL
  ▼
Customer checkout page
  │
  │ 3. Customer pays exact amount through official InstaPay app
  ▼
Merchant Android phone
  │
  │ 4. Official InstaPay app posts "received payment" notification
  ▼
Detector APK NotificationListenerService
  │
  │ 5. Parses amount/sender and POSTs /api/webhooks/instapay using detectToken
  ▼
Gateway matcher
  │
  │ 6. Confirms matching PENDING transaction, logs mismatches otherwise
  ▼
Merchant webhook
     7. Receives HMAC-SHA256 signed confirmation event
```

## Core features

- Merchant signup with email OTP verification and disposable-email blocking.
- Merchant approval and lifecycle management from the admin portal/admin APK.
- Hosted checkout sessions with exact EGP amount and static InstaPay payment URL reuse.
- Merchant dashboard with setup checklist, plan/quota status, transactions, billing, integration credentials, webhook configuration, and detector APK download.
- Admin portal with tabs for ops, merchants, transactions, billing, notifications, webhooks, activity, settings, and audit.
- Admin APK with native Android access to major admin capabilities.
- Detector APK login with merchant email, password, and OTP.
- Detector APK background listener using Android `NotificationListenerService`.
- Background merchant notification polling in the Detector APK via foreground sync service.
- HMAC-SHA256 signed merchant webhooks with timestamp and event ID headers.
- Mismatched payment logging for received payments that cannot be matched to an open checkout.
- Plan subscription flow using exact InstaPay plan-price payment confirmation.
- Arabic/English website language toggle with RTL support.
- SQLite support for local development and PostgreSQL support for production.

## Technology stack

### Web platform

- Next.js 16 / React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui and Radix UI primitives
- Prisma ORM
- SQLite for local development
- PostgreSQL on Supabase for production
- Vercel for hosting

### Android

- Kotlin
- Gradle Kotlin DSL
- Android `NotificationListenerService`
- Foreground service for detector background sync
- AndroidX Security encrypted preferences
- OkHttp/WebSocket integrations

## Data model summary

The Prisma schemas are:

- Local: `instapay_payment_gateway/prisma/schema.prisma`
- Production: `instapay_payment_gateway/prisma/schema.production.prisma`

Important models:

| Model | Purpose |
| --- | --- |
| `Owner` | Platform owner/admin account and platform settings |
| `Client` | Merchant account, approval status, keys, webhook settings, plan/quota state |
| `Transaction` | Checkout and subscription payment lifecycle |
| `WebhookLog` | Merchant webhook delivery audit trail and retry state |
| `MismatchedPayment` | Received payment notifications that did not match a pending checkout |
| `DetectorDevice` | Detector heartbeat/device state |
| `Plan` | Subscription plan pricing and monthly transaction limits |

Typical transaction states:

- `PENDING`
- `CONFIRMED`
- `EXPIRED`
- `UNDERPAID`

## Environment variables

Copy the example file and fill real values locally:

```bash
cd instapay_payment_gateway
cp .env.example .env
```

Key variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | SQLite URL locally or pooled PostgreSQL URL in production |
| `DIRECT_URL` | Production | Direct PostgreSQL connection for migrations when needed |
| `OWNER_SECRET` | Yes | Signs sessions and authorizes owner API operations |
| `TOKEN_PEPPER` | Yes | Pepper for hashing API/detector/webhook secrets |
| `ADMIN_EMAIL` | Yes | Owner login email |
| `ADMIN_PASSWORD` | Yes | Owner login password bootstrap/config |
| `ADMIN_TOTP_SECRET` | Recommended | Admin 2FA TOTP secret |
| `NEXT_PUBLIC_ADMIN_PORTAL_PATH` | Optional | Obscured admin portal path segment |
| `PLATFORM_INSTAPAY_HANDLE` | Required for billing | InstaPay account receiving subscription payments |
| `PLATFORM_INSTAPAY_PAYMENT_URL` | Required for billing | Static InstaPay payment/share URL for platform subscription payments |
| `EMAIL_FROM` | Required for OTP | Sender identity for verification emails |
| `RESEND_API_KEY` | Recommended | Email provider for Vercel deployments |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Alternative | SMTP fallback for OTP email |
| `CHECKOUT_TTL_MIN` | Optional | Pending checkout lifetime in minutes |
| `NOTIFIER_URL`, `NEXT_PUBLIC_NOTIFIER_URL` | Optional | Socket.IO notifier endpoint |
| `ALLOW_HTTP_WEBHOOKS`, `ALLOW_PRIVATE_WEBHOOKS` | Dev only | Relax webhook URL validation locally |
| `SEED_PLANS_ON_STARTUP` | Dev only | Temporary plan seeding on app startup |

Generate strong secrets with:

```bash
openssl rand -hex 32
```

## Local web development

Prerequisites:

- Node.js 20+
- npm
- SQLite for default local development

Commands:

```bash
cd instapay_payment_gateway
npm install
npm run db:generate
npm run db:push
npm run db:seed:plans
npm run dev
```

Open:

```text
http://localhost:3000
```

Build locally:

```bash
npm run build
```

## Production deployment on Vercel

The Vercel project is linked through `.vercel/project.json`. Deploy from the repository root because the Vercel project root directory is configured as `instapay_payment_gateway`.

```bash
cd /home/shabana/Downloads/instapay
npx vercel deploy --prod --yes
```

Important deployment notes:

- Do not run deploy from inside `instapay_payment_gateway/` unless the Vercel root directory setting is changed.
- Production uses `prisma/schema.production.prisma`.
- The current build script copies the production schema and runs Prisma generation/build steps.
- The build currently calls `prisma db push --accept-data-loss` when `VERCEL=1`; for stricter production operations, prefer explicit migrations as described in `docs/OPERATIONS.md`.
- `mini-services/` is excluded from the Next.js TypeScript scope because it is a separate service with its own dependencies.

## Database operations

Local schema push:

```bash
cd instapay_payment_gateway
npm run db:push
```

Seed plans:

```bash
npm run db:seed:plans
```

Recommended production migration flow:

```bash
npx prisma migrate deploy
npm run db:backfill:hardening
npm run db:seed:plans
npm run build
```

See `instapay_payment_gateway/docs/OPERATIONS.md` for the hardening rollout and migration notes.

## Merchant onboarding flow

1. Merchant opens `/register`.
2. Merchant enters business name, email, password, and email OTP.
3. Gateway rejects disposable/temp email domains.
4. Merchant account is created as pending review.
5. Admin approves the merchant from the admin portal/admin APK.
6. Merchant signs in at `/login` with OTP verification.
7. Merchant completes operational setup in `/dashboard`:
   - receiving InstaPay handle
   - exact static InstaPay payment URL copied from the InstaPay app
   - webhook endpoint
   - checkout expiration
   - API credentials
8. Merchant installs and logs into the Detector APK.

## Checkout API

Create a checkout from the merchant backend:

```bash
curl -X POST https://instapay-ruddy.vercel.app/api/v1/checkout/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MERCHANT_API_KEY>" \
  -d '{
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1004"
  }'
```

Expected response shape:

```json
{
  "ok": true,
  "checkout": {
    "sessionId": "cmt...",
    "status": "PENDING",
    "amountEgp": 50,
    "deepLinkUrl": "https://ipn.eg/S/merchant/instapay/token",
    "checkoutUrl": "https://instapay-ruddy.vercel.app/pay/..."
  }
}
```

Check status:

```bash
curl https://instapay-ruddy.vercel.app/api/v1/checkout/status?sessionId=<SESSION_ID> \
  -H "Authorization: Bearer <MERCHANT_API_KEY>"
```

## Detector webhook

The Detector APK reports received InstaPay notifications to:

```text
POST /api/webhooks/instapay
```

Payload example:

```json
{
  "amountEgp": 50,
  "senderHandle": "customer@instapay",
  "recipientHandle": "merchant@instapay",
  "reference": "optional-ref",
  "notificationTimestamp": "2026-08-29T00:00:00.000Z",
  "rawNotificationText": "لقد استلمت 50.00 جنيه من customer@instapay",
  "sourcePackage": "com.egyptianbanks.instapay",
  "confidence": 95
}
```

Authentication uses the merchant `detectToken`.

## Merchant webhook delivery

When a checkout is confirmed, the gateway sends a callback to the merchant webhook endpoint.

Headers:

```text
X-Instapay-Event-Id: <unique-event-id>
X-Instapay-Timestamp: <unix-seconds>
X-Instapay-Signature-Version: v1
X-Instapay-Signature: v1=<hex-hmac>
```

Signature base string:

```text
<timestamp>.<raw-json-body>
```

Verification:

```text
HMAC-SHA256(base_string, webhookSecret)
```

Merchant systems should:

- verify the signature with timing-safe comparison
- reject stale timestamps
- reject already-seen event IDs
- treat webhook delivery as at-least-once
- make order fulfillment idempotent

## Static InstaPay payment URLs

Every merchant should store the exact static payment/share URL copied from the official InstaPay app, for example:

```text
https://ipn.eg/S/mohammedshabana77/instapay/1QduWC
```

The gateway reuses the stored URL unchanged for checkout sessions. The trailing token is not generated per transaction.

Dashboard path:

```text
Dashboard → Integration → Payment Link & Webhook Settings → Static InstaPay Payment URL
```

## Subscription billing

Plans are stored in the `Plan` table and managed by the admin.

Merchant flow:

1. Merchant opens dashboard Billing tab.
2. Merchant selects a paid plan.
3. Gateway creates a subscription-purpose `Transaction`.
4. Merchant pays the exact plan amount through InstaPay to `PLATFORM_INSTAPAY_HANDLE`.
5. Detector confirms the payment notification.
6. Gateway activates the selected plan, resets monthly quota, and sets the plan expiry.

Operational constraint:

The detector confirming platform subscription payments must run on the Android phone that receives payments for `PLATFORM_INSTAPAY_HANDLE`.

## Android Detector APK

Purpose:

- Listen to official InstaPay receipt notifications.
- Parse Arabic/English receipt formats.
- Report confirmed incoming transfers to the gateway.
- Show merchant profile, plan, quota, listener status, and recent transactions.
- Receive admin-sent merchant notifications in the app/status bar.

Important implementation details:

- Package: `com.instapaydetector.app`
- Main listener: `InstaPayNotificationListener`
- Startup receiver: `DetectorStartupReceiver`
- Background notification sync: `MerchantNotificationService` and `MerchantNotificationPoller`
- Notification icon: IPN-derived monochrome status icon
- Credentials are stored in encrypted shared preferences.

Build:

```bash
cd instapay-detector-android
./gradlew :app:assembleRelease
cp -f app/build/outputs/apk/release/app-release.apk ../apks/InstaPay-Detector.apk
```

Install on connected phone:

```bash
adb install -r ../apks/InstaPay-Detector.apk
adb shell dumpsys package com.instapaydetector.app | rg "versionName|versionCode"
```

Required phone setup:

- Install the Detector APK.
- Log in with merchant email, password, and OTP.
- Grant Android notification-listener access.
- Allow unrestricted battery/background running where possible.
- Confirm the official InstaPay app can show received-payment notifications.

## Android Admin APK

Purpose:

- Native owner/admin operations console.
- Manage merchants, subscriptions, transactions, notifications, webhooks, settings, and audit data.

Build:

```bash
cd instapay-detector-android
./gradlew :admin:assembleRelease
cp -f admin/build/outputs/apk/release/admin-release.apk ../apks/InstaPay-Admin.apk
```

Install on connected phone:

```bash
adb install -r ../apks/InstaPay-Admin.apk
adb shell dumpsys package com.instapaydetector.admin | rg "versionName|versionCode"
```

## Language support

The website includes a top-bar Arabic/English toggle:

- English uses LTR layout.
- Arabic uses RTL layout.
- Locale is persisted in localStorage and a cookie.
- Code blocks, API examples, email fields, URLs, passwords, and numeric inputs stay LTR.

Implementation:

- `src/components/language-runtime.tsx`
- `src/lib/i18n-runtime.ts`
- RTL base styles in `src/app/globals.css`

## Security notes

- Do not commit `.env`, Vercel tokens, GitHub/GitLab PATs, SMTP passwords, database passwords, or generated merchant secrets.
- Rotate any secret that has been exposed in chat logs, screenshots, or committed files.
- Merchant API keys, detector tokens, and webhook secrets should be hashed at rest.
- Webhook URLs should be public HTTPS URLs in production.
- Admin access should use strong password plus TOTP.
- Detector APK should be installed only on trusted merchant receiving devices.
- Notification-listener permission is powerful; the Detector APK filters to InstaPay package notifications and should not transmit unrelated notification content.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Vercel says root directory does not exist | Deploy command was run from inside `instapay_payment_gateway` while Vercel root is also configured to that directory | Run `npx vercel deploy --prod --yes` from repository root |
| Vercel TypeScript fails on `mini-services/checkout-notifier` | Separate service files are included in Next.js typecheck | Keep `mini-services` excluded in `tsconfig.json` |
| Merchant dashboard shows duplicated text | Runtime translation loop or parent-level text replacement | Use per-text-node translation storage in `LanguageRuntime` |
| Detector does not see payments | Notification access not granted, InstaPay notifications disabled, or Android battery restrictions | Grant notification access, enable InstaPay notification category, allow unrestricted background usage |
| Detector receives payment but gateway does not confirm | Amount/sender does not match any pending checkout | Verify exact amount and sender handle used in checkout |
| Webhook delivery fails | Merchant endpoint unreachable or signature handling incorrect | Check `WebhookLog`, endpoint HTTPS availability, and HMAC verification |
| Subscription does not activate | Plan payment was not received by the configured platform account detector | Confirm `PLATFORM_INSTAPAY_HANDLE`, static platform payment URL, and detector phone/account |
| GitLab push to `main` fails | Protected branch policy | Push to an allowed branch and create a merge request, or adjust GitLab permissions |

## Common commands

```bash
# Web app
cd instapay_payment_gateway
npm run dev
npm run build
npm run db:push
npm run db:seed:plans

# Production deploy from repo root
cd /home/shabana/Downloads/instapay
npx vercel deploy --prod --yes

# Detector APK
cd instapay-detector-android
./gradlew :app:assembleRelease
cp -f app/build/outputs/apk/release/app-release.apk ../apks/InstaPay-Detector.apk
adb install -r ../apks/InstaPay-Detector.apk

# Admin APK
./gradlew :admin:assembleRelease
cp -f admin/build/outputs/apk/release/admin-release.apk ../apks/InstaPay-Admin.apk
adb install -r ../apks/InstaPay-Admin.apk

# Android diagnostics
adb devices
adb logcat -d -t 500 | rg -i "FATAL EXCEPTION|AndroidRuntime|InstaPayListener|MerchantNotif"
adb shell settings get secure enabled_notification_listeners
```

## Project status

Active development. The current focus areas are:

- replacing runtime DOM translation with first-class route/message-based i18n
- completing production-safe Prisma migrations
- removing remaining plaintext secret dependencies after one-time secret reveal is implemented
- adding durable background jobs for failed webhook retries
- improving detector heartbeat visibility in merchant/admin dashboards

## Disclaimer

This project is not affiliated with the Central Bank of Egypt, InstaPay, or the Instant Payment Network. It does not move money or access official banking APIs. It relies on notifications that the official InstaPay app posts on the receiving merchant device. Use only with explicit merchant consent and appropriate operational controls.
