# InstaPay Gateway Operations

## Production deployment

The application build no longer mutates the production database. Production database
changes should be applied explicitly before or during deploy with:

```bash
npx prisma migrate deploy
npm run build
```

Do not use `prisma db push --accept-data-loss` against production.

## Plan seeding

Subscription plans are no longer seeded as a side effect of importing the database
client. Run the explicit seed command when bootstrapping an environment:

```bash
npm run db:seed:plans
```

If a temporary startup seed is required in a disposable environment, set:

```bash
SEED_PLANS_ON_STARTUP=1
```

Do not enable that flag for production serverless deployments.

## Merchant webhook requirements

Merchant webhook URLs must be public HTTPS URLs by default.

Development-only overrides:

```bash
ALLOW_HTTP_WEBHOOKS=1
ALLOW_PRIVATE_WEBHOOKS=1
```

Each webhook delivery includes:

- `X-Instapay-Event-Id`: unique event ID
- `X-Instapay-Timestamp`: Unix timestamp in seconds
- `X-Instapay-Signature-Version`: currently `v1`
- `X-Instapay-Signature`: `v1=<hex hmac>`

Signature base string:

```text
<timestamp>.<raw-json-body>
```

HMAC algorithm:

```text
HMAC-SHA256(base_string, webhookSecret)
```

Merchant servers should reject old timestamps and already-seen event IDs to prevent
replay attacks.

## Hardening phase 1 rollout

This release adds backward-compatible columns for:

- integer money storage: `amountCents`, `detectedAmountCents`
- hashed auth lookup: `apiKeyHash`, `detectTokenHash`, `webhookSecretHash`
- token usage timestamps
- webhook retry metadata
- detector device heartbeat records

Recommended rollout order:

```bash
npx prisma migrate deploy
npm run db:backfill:hardening
npm run db:seed:plans
npm run build
```

## Merchant plan subscription flow

Merchants can subscribe from the dashboard `Plans & Billing` tab.

Configuration required:

```bash
PLATFORM_INSTAPAY_HANDLE=your_platform_handle@instapay
PLATFORM_INSTAPAY_PAYMENT_URL=https://ipn.eg/S/your_platform_handle/instapay/1QduWC
```

Flow:

1. Merchant selects a paid plan.
2. Gateway creates a `Transaction` with `purpose = SUBSCRIPTION`.
3. Merchant pays the exact monthly plan price to `PLATFORM_INSTAPAY_HANDLE`.
4. The detector webhook confirms the subscription transaction.
5. The gateway activates the selected plan for 30 days, resets `txCount`, and
   sets `txLimit` from the selected `Plan.maxTransactions`.

Operational constraint: the Android detector that reports subscription payments
must be connected to the phone/account that receives payments for
`PLATFORM_INSTAPAY_HANDLE`, because notification-based confirmation only works on
the receiving device.

## Static InstaPay payment URLs

Each receiving InstaPay account has a static payment/share URL from the official
InstaPay APK, for example:

```text
https://ipn.eg/S/mohammedshabana77/instapay/1QduWC
```

The gateway stores this exact URL per merchant in `Client.instapayPaymentUrl` and
reuses it unchanged for every checkout. The trailing token is not regenerated per
checkout.

Merchants can set this in the dashboard under:

```text
Developer Integration → Payment Link & Webhook Settings → Static InstaPay Payment URL
```

For admin subscription payments, set `PLATFORM_INSTAPAY_PAYMENT_URL` in
production. If a static URL is missing, the gateway falls back to a derived URL
for compatibility, but production merchants should have their exact APK URL
configured.

The code uses the new columns when present and falls back to legacy columns where
needed. This avoids breaking existing merchant integrations and already-installed
detector APKs.

New checkouts and detector reports write integer cents fields. Legacy float EGP
fields are still retained for compatibility during this phase.

API key and detector token authentication now tries hashed lookup first, then
legacy plaintext lookup. If a legacy plaintext token is used and no hash exists,
the hash is populated opportunistically.

Important: do not clear plaintext token columns until the dashboard/internal API
auth flow and Android APK token bootstrap flow have been updated to support
one-time token reveal or encrypted secret retrieval.

## Remaining hardening phases

These require explicit schema/data migration:

1. Complete money migration by making cents columns required, then removing float
   fields after all code and historical data are migrated.
2. Complete plaintext-secret removal after introducing one-time token reveal and
   removing dashboard dependence on plaintext API keys.
3. Add a background worker for retrying failed `WebhookLog` records where
   `isSuccess = false` and `nextAttemptAt <= now`.
4. Surface detector heartbeat/device state in the admin and merchant dashboards.
