# InstaPay Detector — Android App

A companion Android app for the InstaPay Detector payment gateway. It listens for InstaPay push notifications and reports them to the gateway webhook so that pending client checkouts can be auto-confirmed.

**Two modes:**

| Mode | Runs on | Listens for | Use case |
|------|---------|-------------|----------|
| **MERCHANT** (default) | The merchant's phone | "You have received X EGP from `<handle>`@instapay" | Primary detection — auto-confirms client payments |
| **CLIENT** (optional) | The client's phone | "You have sent X EGP to `<handle>`@instapay" | Belt-and-suspenders backup — reports the client's outgoing transfer as a secondary signal |

> ⚠️ **This is a sandbox/demo project.** It does not move real money, does not connect to the official InstaPay backend, and does not modify the InstaPay app. It only *reads* the notifications that the official InstaPay app already posts on the device. Do not use it to deceive any person about a payment's status.

---

## What's new in this version

- **Official InstaPay deep link** — the waiting screen now generates an `https://ipn.eg/S/<localPart>/instapay/<token>` URL (the same format the real InstaPay app uses for sharing). Clicking it on a mobile device opens the InstaPay app with the recipient pre-filled.
- **QR code** — the deep link is rendered as a scannable QR code (matching the format in the official InstaPay app: handle below + "Powered by InstaPay" attribution).
- **WebSocket real-time updates** — the waiting screen now flips to "confirmed" instantly via socket.io instead of polling every 2-3 seconds. A "Live" badge shows the connection status; polling remains as a fallback.
- **Merchant dashboard** — a new "Dashboard" tab on the gateway shows today's total, 7-day total, pending count, and a recent-activity list (auto-refreshes every 10s).
- **Configurable merchant handle** — the merchant handle is now read from the `MERCHANT_HANDLE` env var instead of being hardcoded. Change it in `.env` to point the gateway at any InstaPay merchant.
- **Client mode (Android)** — the detector app can now run in CLIENT mode on the payer's phone, listening for "You have sent X EGP to `<handle>`@instapay" notifications as a backup detection signal.

---

## How the whole system works

```
 ┌────────────────┐    1. Enter username + amount     ┌──────────────────┐
 │  Client (web)  │ ─────────────────────────────────▶│  Gateway (web)   │
 │  InstaPay      │                                    │  creates PENDING  │
 │  username      │ ◀─────────────────────────────────│  checkout         │
 └────────────────┘    2. Returns checkout sessionId   └──────────────────┘
        │                                                       ▲
        │ 3. Opens the official InstaPay app                    │
        │    and sends X EGP to                                  │
        │    mohammedshabana77@instapay                          │
        ▼                                                       │
 ┌────────────────┐    4. InstaPay app posts a               │
 │  Official      │       "received" notification             │
 │  InstaPay app  │       on the merchant's phone             │
 │  (merchant)    ──────▶  ┌────────────────────┐              │
 └────────────────┘         │ This Detector app  │              │
                            │  (Notification-     │              │
                            │   ListenerService)  │              │
                            └─────────┬──────────┘              │
                                      │ 5. POST /api/webhooks/   │
                                      │    instapay              │
                                      └─────────────────────────┘
                                                 │
                                                 ▼
                            6. Gateway matches PENDING checkout
                               with matching (senderHandle, amount)
                               → marks CONFIRMED

                            7. Client polls /api/checkout/[id]
                               → sees CONFIRMED → success screen
```

---

## Required Android permissions

| Permission | Why it's needed |
|------------|-----------------|
| `BIND_NOTIFICATION_LISTENER_SERVICE` | Allows the app to receive callbacks whenever *any* app on the device posts a notification. We filter to only act on notifications from `com.egyptianbanks.instapay`. Must be granted manually by the user in Android Settings. |
| `INTERNET` | So the detector can POST parsed notifications to the gateway webhook. |
| `ACCESS_NETWORK_STATE` | To gracefully handle offline scenarios. |
| `POST_NOTIFICATIONS` (Android 13+) | Used only for the low-priority status notification showing whether the detector is listening. Not required for the core functionality. |

The app does **NOT** request:
- SMS or call log permissions
- Accessibility service permissions
- Overlay / draw-over-app permissions
- Camera, microphone, location, contacts
- Background location

The notification-listener permission is powerful, which is why Android requires the user to grant it manually and shows a clear warning. Review the source code in `app/src/main/java/com/instapaydetector/app/InstaPayNotificationListener.kt` before installing — you can verify that it only inspects notifications from `com.egyptianbanks.instapay` and only transmits data to the gateway URL you configure.

---

## Build instructions

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34 (compileSdk) and minimum SDK 24 (Android 7.0)

### Steps
1. Open Android Studio → **File → Open** → select the `instapay-detector-android` folder.
2. Wait for Gradle sync to complete. (If asked, accept the suggested Gradle wrapper and AGP version.)
3. Connect an Android device (or start an emulator) with Android 7.0+.
4. Click **Run** ▶ to install and launch the app.

### Building a release APK
```bash
cd instapay-detector-android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```
Sign it with your own keystore before distribution. See [Android signing docs](https://developer.android.com/build/building-cmdline#sign_cmdline).

---

## Setup (one-time, on the merchant's phone)

1. **Install** the InstaPay Detector APK on the merchant's Android phone.
2. **Open** the app. You'll see the settings screen.
3. **Choose detector mode** — tap **Merchant** (default) or **Client**.
   - Use **Merchant** on the phone that receives payments.
   - Use **Client** (optional) on the payer's phone for backup detection.
4. **Enter the gateway webhook URL** — this is your deployed Next.js gateway's URL, e.g.:
   ```
   https://your-gateway.example.com/api/webhooks/instapay
   ```
5. **Enter the auth token** — this must match the `DETECT_TOKEN` env var on your gateway. For the sandbox default it's:
   ```
   instapay-sandbox-detector-token-2026
   ```
   **Change this token in production** to a strong random string (≥ 32 chars).
6. **Enter the merchant handle** (e.g. `mohammedshabana77@instapay`).
7. **In CLIENT mode only:** enter **your own InstaPay handle** — this is required so the webhook knows who sent the payment. Without it, client mode can't report.
8. Tap **Save**.
9. Tap **Grant notification access**. Android will open Settings → Notification access.
   - Find **InstaPay Detector** in the list.
   - Toggle it **On**.
   - Android will show a warning — review it, then tap **Allow**.
10. Return to the app. The status card should now show **"Notification access: granted ✓"** and a mode-specific listening message.

A persistent low-priority notification will appear in the notification shade showing that the detector is active. This is normal and required so Android doesn't kill the service in the background.

---

## Testing

### Option A: Real end-to-end test (recommended)
1. Open the gateway website on any device.
2. Enter a friend's InstaPay username (e.g. `ahmed_saleh123`) and an amount (e.g. `1.00 EGP`).
3. Tap **Generate payment request** — you'll see the waiting screen.
4. Ask your friend to open **their** InstaPay app and send `1.00 EGP` to `mohammedshabana77@instapay`.
5. Within ~2 seconds of the merchant's phone receiving the InstaPay "You have received 1.00 EGP from ahmed_saleh123@instapay" notification, the detector will POST it to the gateway and the client's waiting screen will flip to **Payment confirmed!**.

### Option B: Simulated webhook test
If you don't have a second InstaPay account handy:
1. Configure the gateway URL + token in the detector app.
2. Open the gateway website and create a checkout for `testuser@instapay` with amount `1.00 EGP`.
3. In the detector app, tap **Send test notification** — it will POST a synthetic `1.00 EGP from testuser@instapay` payload directly to the webhook (bypassing the real InstaPay app).
4. The client's waiting screen should flip to **confirmed** within 2 seconds.

### Option C: Pure curl test (no Android needed)
```bash
curl -X POST https://your-gateway.example.com/api/webhooks/instapay \
  -H "Authorization: Bearer instapay-sandbox-detector-token-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "amountEgp": 1.00,
    "senderHandle": "testuser@instapay",
    "reference": "TEST-12345"
  }'
```

---

## Privacy & security notes

- **The detector only inspects notifications from `com.egyptianbanks.instapay`.** All other notifications (WhatsApp, banking apps, SMS, etc.) are ignored.
- **The detector only transmits to the gateway URL you configure.** No telemetry, no third-party endpoints.
- **The gateway URL and auth token are stored in encrypted SharedPreferences** using AndroidX Security Crypto (AES-256). They are excluded from cloud backups.
- **The auth token is a shared secret.** Anyone who has it can POST fake payment confirmations to your gateway. Use a strong token (≥ 32 random chars) in production, rotate it periodically, and never commit it to a public repo.
- **The gateway validates the token on every webhook call** and rejects unauthorized requests with HTTP 401.
- **Notification access is revocable at any time** from Android Settings → Notification access. The detector will stop working immediately.
- **Android may kill the listener service** under extreme memory pressure or after a device reboot. The persistent status notification reduces the likelihood of this. On reboot, the service auto-restarts (Android re-binds NotificationListenerService after reboot if the permission is still granted).
- **The InstaPay notification text format could change** if the official app is updated. The regex parser in `InstaPayNotificationListener.kt` is intentionally lenient, but if InstaPay changes its wording significantly, you'll need to update the `receivedPattern` regex.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Permission status shows "not granted ✗" | User hasn't enabled notification access | Tap "Grant notification access" and toggle InstaPay Detector on |
| Listener shows "idle" but permission is granted | Service hasn't been bound by the system yet | Toggle the permission off and on, or reboot the device |
| Test button shows "Webhook POST failed" | Wrong URL or token, or gateway offline | Verify URL ends in `/api/webhooks/instapay`, verify token matches `DETECT_TOKEN` on the gateway |
| Real InstaPay payment doesn't trigger detection | InstaPay app's notifications are disabled | Settings → Apps → InstaPay → Notifications → enable "Received money" (or equivalent) |
| Detection fires but gateway returns `matched: false` | The client typed a different username or amount on the website | The username on the website must match the sender handle in the InstaPay notification *exactly* (case-insensitive, but the local part must match) |
| Multiple checkouts for the same user+amount | Gateway matches the oldest PENDING one | Wait for the first one to expire (10 min) before retrying, or complete the first one |

---

## File structure

```
instapay-detector-android/
├── build.gradle.kts                      # Project-level Gradle config
├── settings.gradle.kts
├── gradle.properties
├── gradle/wrapper/gradle-wrapper.properties
├── README.md                              # ← you are here
└── app/
    ├── build.gradle.kts                  # App-level Gradle config (dependencies, SDK versions)
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml           # Declares permissions + NotificationListenerService
        ├── java/com/instapaydetector/app/
        │   ├── MainActivity.kt           # Setup screen (mode toggle, URL, token, handles, grant permission)
        │   ├── InstaPayNotificationListener.kt   # Core listener — parses received/sent notifications
        │   ├── GatewayClient.kt          # HTTP POST to the gateway webhook
        │   └── GatewayConfig.kt          # Encrypted storage of URL + token + mode + handles
        └── res/
            ├── layout/activity_main.xml  # Settings UI with mode toggle
            ├── values/strings.xml
            ├── values/colors.xml
            ├── values/themes.xml
            ├── drawable/ic_brand_logo.xml
            └── xml/backup_rules.xml + data_extraction_rules.xml
```

---

## License & disclaimer

This project is provided as-is for educational and sandbox testing purposes. It is **not affiliated with, endorsed by, or connected to** the Egyptian Banks Company, the Instant Payment Network, or the official InstaPay app. "InstaPay" and related marks belong to their respective owners.

Do not use this software to misrepresent payment status to any person, merchant, or platform. The merchant must always independently verify actual fund receipt via the official InstaPay app before shipping goods or services.
