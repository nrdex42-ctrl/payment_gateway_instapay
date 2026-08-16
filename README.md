# 💳 InstaPay Payment Gateway & Android Detector System

A high-performance payment gateway for **InstaPay Egypt** with real-time push notification detection, automated checkout generation, WebSocket payment confirmation, and pre-compiled Android release applications.

---

## 📁 Repository Structure

```
.
├── apks/
│   ├── InstaPay-Owner-Console.apk         # Admin console & InstaPay notification detector
│   └── InstaPay-Client-Integration.apk    # Merchant/client checkout generator & developer hub
├── instapay-detector-android/              # Native Android App (Kotlin / Jetpack / Gradle)
├── instapay_payment_getway/                # Next.js 16 Gateway API + Socket.IO Notifier Service
├── render.yaml                             # 1-Click Render Blueprint deployment spec
└── README.md
```

---

## 📦 Generated Release APKs

Located in `apks/`:

| APK File | Target Role | Key Features |
|---|---|---|
| `InstaPay-Owner-Console.apk` | Gateway Owner / Merchant Admin | Executive Dashboard, Live Revenue Analytics, Multilingual Push Notification Listener (Arabic & English), Persistent Offline Retry Queue, Gateway Health Diagnostics. |
| `InstaPay-Client-Integration.apk` | Client / Integration Partner | Interactive Payment Link & QR Code Generator, Real-time WebSocket Waiting Screen, Developer Center (API Key, HMAC Signer, JavaScript/Python/PHP/cURL Snippets). |

---

## ⚡ Deployment on Render

This repository includes a pre-configured `render.yaml` Blueprint:

1. Push this repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com/) → **New +** → **Blueprint**.
3. Select your repository `payment_getway_instapay`.
4. Provide your PostgreSQL database connection string (`DATABASE_URL`) and `DETECT_TOKEN`.
5. Deploy! Both the `instapay-gateway` Next.js service and `instapay-notifier` WebSocket service will be automatically built and linked.
