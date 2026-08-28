# InstaPay Gateway Web Platform

This directory contains the Next.js web/API platform for the InstaPay Egypt Payment Gateway.

For the complete system documentation, including architecture, environment variables, deployment, Android APKs, checkout API, webhooks, billing, troubleshooting, and operations notes, see the repository root README:

```text
../README.md
```

Useful local commands:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed:plans
npm run dev
npm run build
```

Deploy production from the repository root, not from this directory:

```bash
cd ..
npx vercel deploy --prod --yes
```

Vercel root directory is configured as `instapay_payment_getway`.
