'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Copy,
  Check,
  Globe,
  Key,
  Layers,
  Lock,
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
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  }
}))

const WEBHOOK_SECRET = 'your_merchant_webhook_secret'
const processedEvents = new Set() // Replace with your database

app.post('/api/webhooks/payment', (req, res) => {
  const signatureHeader = req.headers['x-instapay-signature'] // format: v1=<signature>
  const timestamp = req.headers['x-instapay-timestamp']
  const eventId = req.headers['x-instapay-event-id']
  
  if (!signatureHeader || !timestamp || !eventId) {
    return res.status(401).json({ error: 'Missing signature headers' })
  }

  // Prevent replay attacks: reject timestamps older than 5 minutes
  const timeDifference = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (timeDifference > 300) {
    return res.status(400).json({ error: 'Timestamp expired' })
  }

  const baseString = \`\${timestamp}.\${req.rawBody}\`
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(baseString)
    .digest('hex')

  const providedSignature = signatureHeader.replace(/^v1=/, '').trim()

  // Time-safe equality check
  const verified =
    providedSignature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))

  if (!verified) {
    return res.status(401).json({ error: 'Invalid webhook signature' })
  }

  if (processedEvents.has(eventId)) {
    return res.status(200).json({ ok: true, duplicate: true })
  }

  const { event, transaction } = req.body
  if (event === 'payment.confirmed') {
    const { sessionId, amountEgp, senderHandle, detectedRef } = transaction
    console.log(\`Success: Received \${amountEgp} EGP from \${senderHandle} (Ref: \${detectedRef})\`)
    // Fulfill the order here, idempotently by sessionId or eventId.
  } else if (event === 'payment.underpaid') {
    // Keep order pending/manual review. detectedAmountEgp is lower than amountEgp.
  } else if (event === 'subscription.payment_confirmed') {
    // Optional: update local merchant billing state if you mirror subscriptions.
  }

  processedEvents.add(eventId)
  res.status(200).json({ ok: true })
})`

const createCheckoutResponse = `{
  "ok": true,
  "checkout": {
    "sessionId": "cmt7qyzda000...",
    "senderHandle": "customer@instapay",
    "recipientHandle": "merchant@instapay",
    "amountEgp": 50,
    "currency": "EGP",
    "status": "PENDING",
    "note": "Order #1004",
    "deepLinkUrl": "https://ipn.eg/S/merchant/instapay/1QduWC",
    "deepLinkToken": "1QduWC",
    "createdAt": "2026-08-29T10:00:00.000Z",
    "expiresAt": "2026-08-29T10:10:00.000Z"
  }
}`

const statusResponse = `{
  "ok": true,
  "checkout": {
    "sessionId": "cmt7qyzda000...",
    "businessName": "Merchant Store",
    "senderHandle": "customer@instapay",
    "recipientHandle": "merchant@instapay",
    "amountEgp": 50,
    "currency": "EGP",
    "status": "CONFIRMED",
    "detectedRef": "IPN notification/reference text",
    "detectedAt": "2026-08-29T10:02:00.000Z",
    "detectedAmountEgp": 50,
    "createdAt": "2026-08-29T10:00:00.000Z",
    "expiresAt": "2026-08-29T10:10:00.000Z",
    "note": "Order #1004"
  }
}`

const webhookPayload = `{
  "id": "1b0b4ef3-6a5d-46c9-9a65-...",
  "created": 1787997600,
  "event": "payment.confirmed",
  "clientId": "merchant_id",
  "businessName": "Merchant Store",
  "transaction": {
    "sessionId": "cmt7qyzda000...",
    "senderHandle": "customer@instapay",
    "recipientHandle": "merchant@instapay",
    "amountEgp": 50,
    "detectedAmountEgp": 50,
    "currency": "EGP",
    "status": "CONFIRMED",
    "detectedRef": "notification/reference text",
    "detectedAt": "2026-08-29T10:02:00.000Z",
    "note": "Order #1004",
    "createdAt": "2026-08-29T10:00:00.000Z"
  }
}`

const errorRows = [
  ['400', 'Invalid request', 'Missing amountEgp, invalid senderHandle, missing sessionId, or invalid settings.'],
  ['401', 'Unauthorized', 'Missing/invalid Bearer API key, or merchant is not approved/active.'],
  ['402', 'Payment required', 'Subscription expired or transaction quota has been reached.'],
  ['404', 'Not found', 'Checkout session does not exist.'],
  ['429', 'Rate limited', 'Too many requests. Use the returned rate-limit headers and retry later.'],
  ['500', 'Server error', 'Unexpected gateway failure. Log the response and retry safely.'],
]

const statusRows = [
  ['PENDING', 'Checkout is waiting for the customer transfer.'],
  ['CONFIRMED', 'Detector matched sender and amount. Fulfill the order.'],
  ['UNDERPAID', 'A transfer was received from the expected sender, but amount was lower than requested. Do not fulfill automatically.'],
  ['EXPIRED', 'Checkout passed its configured TTL before confirmation.'],
]

interface DocTranslations {
  navTitle: string
  merchantConsole: string
  gettingStarted: string
  overview: string
  howItWorks: string
  auth: string
  productionChecklist: string
  apiReference: string
  createCheckout: string
  checkStatus: string
  webhookIntegration: string
  webhookCallbacks: string
  signatureValidation: string
  retryPolicy: string
  errorsAndLimits: string
  heroTitle: string
  heroDesc: string
  simpleApiTitle: string
  simpleApiDesc: string
  webhookDeliveryTitle: string
  webhookDeliveryDesc: string
  hmacTitle: string
  hmacDesc: string
  step1Title: string
  step1Desc: string
  step2Title: string
  step2Desc: string
  step3Title: string
  step3Desc: string
  authDesc: string
  authWarning: string
  checklistItems: string[]
  createCheckoutDesc: string
  reqBodyParams: string
  fieldCol: string
  typeCol: string
  reqCol: string
  descCol: string
  amountDesc: string
  senderDesc: string
  noteDesc: string
  successResponse: string
  deepLinkNote: string
  checkStatusDesc: string
  queryParams: string
  sessionParamDesc: string
  statusValues: string
  statusDescriptions: Record<string, string>
  webhooksDesc: string
  webhookEventPayload: string
  webhookDeliveryNote: string
  signatureValidationDesc: string
  retryPolicyDesc: string
  errorsDesc: string
  httpCol: string
  meaningCol: string
  actionCol: string
  footerCopyright: string
  footerSupport: string
}

const translations: Record<'en' | 'ar', DocTranslations> = {
  en: {
    navTitle: 'Merchant Documentation v2.0',
    merchantConsole: 'Merchant Console',
    gettingStarted: 'Getting Started',
    overview: 'Overview',
    howItWorks: 'How it works',
    auth: 'Authentication',
    productionChecklist: 'Production checklist',
    apiReference: 'API Reference',
    createCheckout: 'Create Checkout',
    checkStatus: 'Check Status',
    webhookIntegration: 'Webhook Integration',
    webhookCallbacks: 'Webhook callbacks',
    signatureValidation: 'Signature validation',
    retryPolicy: 'Retry policy',
    errorsAndLimits: 'Errors & Rate Limits',
    heroTitle: 'InstaPay Gateway API Documentation',
    heroDesc: 'Integrate automated Egyptian Instant Payment Network (InstaPay) transfers into your eCommerce store, SaaS platform, or mobile application.',
    simpleApiTitle: 'Simple REST API',
    simpleApiDesc: 'Generate inline payments and dynamic checkout sessions with a single server-to-server POST request.',
    webhookDeliveryTitle: 'Instant Webhooks',
    webhookDeliveryDesc: 'Receive instantaneous notifications at your backend server the moment bank transfers are detected.',
    hmacTitle: 'HMAC SHA256 Signed',
    hmacDesc: 'Every webhook payload carries a timestamped SHA256 signature for complete request authenticity and security.',
    step1Title: 'Create Checkout Session',
    step1Desc: 'Your backend calls the Checkout API. The gateway returns a session ID, deep link URL, and transaction timestamps.',
    step2Title: 'Customer Pays via InstaPay',
    step2Desc: 'The customer scans the QR code or opens the InstaPay link on their phone and transfers the amount from their bank account.',
    step3Title: 'Automatic Detection & Webhook',
    step3Desc: 'The merchant Android Detector APK reads the bank notification, matches the session, and triggers an HMAC-signed webhook to your server.',
    authDesc: 'Authenticate server-side API requests by providing your merchant API Key inside the standard HTTP Authorization header. API Keys are generated in your dashboard under the Developers tab.',
    authWarning: 'Keep your API key secret on your backend server. Never expose it in browser JavaScript, frontend apps, or public repositories.',
    checklistItems: [
      'Merchant account is approved and active.',
      'Receiving InstaPay handle is configured in the dashboard.',
      'Static InstaPay payment URL is pasted exactly from the InstaPay app.',
      'Webhook URL is a public HTTPS endpoint.',
      'Webhook secret is generated and stored server-side.',
      'Detector APK is installed, logged in, and notification access is granted.',
      'Your backend handles webhook events idempotently.',
      'Your order system handles UNDERPAID and EXPIRED without auto-fulfillment.',
    ],
    createCheckoutDesc: 'Creates a new checkout session. It returns the session parameters, deep link URL, and expiration timestamps.',
    reqBodyParams: 'Request Body Parameters',
    fieldCol: 'Field',
    typeCol: 'Type',
    reqCol: 'Required',
    descCol: 'Description',
    amountDesc: 'Amount in Egyptian Pounds (EGP). Must be positive. Precision stored in EGP cents.',
    senderDesc: 'Customer InstaPay sender handle (e.g. user@instapay or phone). Used for exact matching.',
    noteDesc: 'Optional reference or order ID (max 200 characters).',
    successResponse: 'Success Response',
    deepLinkNote: 'deepLinkUrl is the merchant static InstaPay payment link. The gateway matches incoming transfers by expected sender, amount, and active session window.',
    checkStatusDesc: 'Get the live status of an existing checkout session. Safe for frontend and mobile polling.',
    queryParams: 'Query Parameters',
    sessionParamDesc: 'The unique session ID returned during checkout creation.',
    statusValues: 'Status Values',
    statusDescriptions: {
      PENDING: 'Checkout is waiting for customer transfer.',
      CONFIRMED: 'Detector matched transfer amount and sender. Fulfill order.',
      UNDERPAID: 'Transfer was detected but received amount was lower than requested.',
      EXPIRED: 'Checkout exceeded time-to-live before payment confirmation.',
      CANCELLED: 'Checkout was cancelled by merchant or customer.',
    },
    webhooksDesc: 'Configure your public webhook URL in the merchant console. The gateway sends real-time POST events when checkouts are completed.',
    webhookEventPayload: 'Webhook Event Payload',
    webhookDeliveryNote: 'Webhooks are delivered as HTTP POST requests with HMAC-SHA256 signature headers.',
    signatureValidationDesc: 'Verify incoming signatures to ensure payloads are authentic and untampered.',
    retryPolicyDesc: 'A webhook is considered successful when your server responds with any 2xx status within 10 seconds. Failed deliveries are automatically retried with exponential backoff up to 5 times.',
    errorsDesc: 'API errors return standard JSON responses with error descriptions. Respect HTTP rate-limit headers.',
    httpCol: 'HTTP Status',
    meaningCol: 'Meaning',
    actionCol: 'Action',
    footerCopyright: 'InstaPay Gateway. All rights reserved.',
    footerSupport: 'For technical inquiries, contact support via WhatsApp: +201114671033 or instapay.payment.gateway@gmail.com',
  },
  ar: {
    navTitle: 'دليل مطوري بوابة إنستاباي v2.0',
    merchantConsole: 'لوحة التحكم',
    gettingStarted: 'البدء السريع',
    overview: 'نظرة عامة',
    howItWorks: 'كيف تعمل البوابة',
    auth: 'المصادقة وتأمين الربط',
    productionChecklist: 'قائمة جاهزية التشغيل',
    apiReference: 'دليل الـ API',
    createCheckout: 'إنشاء جلسة دفع',
    checkStatus: 'الاستعلام عن الحالة',
    webhookIntegration: 'ربط الويب هوك (Webhooks)',
    webhookCallbacks: 'إشعارات الويب هوك',
    signatureValidation: 'التحقق من التوقيع الرقمي',
    retryPolicy: 'سياسة إعادة المحاولة',
    errorsAndLimits: 'الأخطاء ومعدل الطلبات',
    heroTitle: 'التوثيق البرمجي ودليل الربط لبوابة إنستاباي',
    heroDesc: 'قم بربط واستقبال مدفوعات شبكة المدفوعات اللحظية المصرية (InstaPay) تلقائياً في متجرك الإلكتروني أو تطبيقك.',
    simpleApiTitle: 'واجهة برمجية REST بسيطة',
    simpleApiDesc: 'أنشئ جلسات دفع وروابط تحويل سريعة بطلب POST مباشر من خادمك.',
    webhookDeliveryTitle: 'إشعارات ويب هوك فورية',
    webhookDeliveryDesc: 'استقبل إشعارات فورية على خادمك بمجرد استلام وتأكيد التحويل البنكي.',
    hmacTitle: 'توقيع مشفر HMAC SHA256',
    hmacDesc: 'كل إشعار يحمل توقيعاً رقمياً مشفراً ومؤقتاً للتحقق من أمان ومصدر الطلب.',
    step1Title: '١. إنشاء جلسة الدفع',
    step1Desc: 'يرسل خادمك طلباً لإنشاء الجلسة، فترد البوابة بمعرف الجلسة ورابط إنستاباي للدفع.',
    step2Title: '٢. قيام العميل بالتحويل',
    step2Desc: 'يقوم العميل بمسح رمز QR أو فتح رابط إنستاباي لإتمام التحويل من حسابه البنكي.',
    step3Title: '٣. الكشف التلقائي وإرسال الويب هوك',
    step3Desc: 'يقوم تطبيق الكاشف Android بقراءة إشعار البنك ومطابقته فورياً، ثم إرسال الويب هوك لخادمك.',
    authDesc: 'تتم المصادقة عبر إرسال مفتاح API Key داخل ترويسة Authorization. يمكنك إنشاء المفاتيح من لوحة التحكم تحت تبويب المطورين.',
    authWarning: 'احتفظ بمفتاح API سراً في خادمك الخلفي فقط، ولا تضعه أبداً في تطبيقات الجوال أو كود الواجهة الأمامية.',
    checklistItems: [
      'حساب التاجر مفعل ومعتمد.',
      'عنوان إنستاباي لاستلام الأموال محدد بدقة في لوحة التحكم.',
      'رابط إنستاباي المباشر منسوخ بدقة من تطبيق إنستاباي الرسمي.',
      'رابط الويب هوك هو عنوان HTTPS عام ومفعل.',
      'تم إنشاء مفتاح سر الويب هوك وحفظه بخادمك.',
      'تم تثبيت تطبيق الكاشف على هاتف التاجر ومنحه إذن الإشعارات.',
      'خادمك يتعامل مع إشعارات الويب هوك بشكل آمن بدون تكرار.',
      'نظامك يتعامل مع حالات نقص المبلغ (UNDERPAID) وانتهاء الوقت (EXPIRED).',
    ],
    createCheckoutDesc: 'إنشاء جلسة دفع جديدة. يرجع الـ API معطيات الجلسة ورابط التحويل ووقت الصلاحية.',
    reqBodyParams: 'معاملات جسم الطلب (Request Body)',
    fieldCol: 'الحقل',
    typeCol: 'النوع',
    reqCol: 'مطلوب',
    descCol: 'الوصف',
    amountDesc: 'المبلغ بالجنيه المصري (EGP). يجب أن يكون رقماً موجباً بدقة القروش.',
    senderDesc: 'عنوان إنستاباي أو رقم هاتف العميل المحول. يعتمد الربط والمطابقة التلقائية عليه.',
    noteDesc: 'وصف أو رقم الطلب اختياري (حد أقصى ٢٠٠ حرف).',
    successResponse: 'استجابة النجاح (Success Response)',
    deepLinkNote: 'deepLinkUrl هو رابط الدفع المحفوظ في لوحة التاجر. تتم المطابقة بمطابقة الحساب والمبلغ ونافذة الجلسة.',
    checkStatusDesc: 'الاستعلام المباشر عن حالة جلسة دفع. آمن للاستخدام من الواجهة الأمامية وتطبيقات الهاتف.',
    queryParams: 'معاملات الرابط (Query Parameters)',
    sessionParamDesc: 'معرف الجلسة الفريد الناتج عند إنشاء الدفع.',
    statusValues: 'قيم الحالات المتاحة',
    statusDescriptions: {
      PENDING: 'الجلسة في انتظار تحويل العميل.',
      CONFIRMED: 'تم استلام وتأكيد التحويل ومطابقة المبلغ. يمكنك تسليم الطلب.',
      UNDERPAID: 'تم تحويل مبلغ أقل من المطلوب. لا تقم بتسليم الطلب تلقائياً.',
      EXPIRED: 'انتهت صلاحية الجلسة قبل إتمام التحويل.',
      CANCELLED: 'تم إلغاء الجلسة من التاجر أو العميل.',
    },
    webhooksDesc: 'حدد رابط الويب هوك في لوحة التحكم لاستلام إشعارات فورية عند تأكيد أي عملية.',
    webhookEventPayload: 'هيكل بيانات الويب هوك (Payload)',
    webhookDeliveryNote: 'تصل الإشعارات كطلبات POST مع ترويسات التوقيع المشفر HMAC-SHA256.',
    signatureValidationDesc: 'تحقق من التوقيع الرقمي لضمان مصداقية الإشعارات القادمة من البوابة.',
    retryPolicyDesc: 'تعتبر المحاولة ناجحة عند استجابة خادمك بكود 2xx خلال ١٠ ثوان. في حال الفشل يتم إعادة الإرسال تلقائياً حتى ٥ محاولات.',
    errorsDesc: 'ترجع الأخطاء بصيغة JSON واضحة. يرجى مراعاة حدود تكرار الطلبات (Rate Limits).',
    httpCol: 'كود HTTP',
    meaningCol: 'المعنى',
    actionCol: 'الإجراء المقترح',
    footerCopyright: 'بوابة إنستاباي للمدفوعات. جميع الحقوق محفوظة.',
    footerSupport: 'للدعم الفني والاستفسارات: واتساب: 201114671033+ أو البريد: instapay.payment.gateway@gmail.com',
  },
}

export default function DocsPage() {
  const [selectedSnippetTab, setSelectedSnippetTab] = useState<keyof CodeSnippets>('curl')
  const [lang, setLang] = useState<'en' | 'ar'>('en')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const t = translations[lang]
  const isRtl = lang === 'ar'

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const snippetTabs: { id: keyof CodeSnippets; label: string; badge: string; icon: string }[] = [
    { id: 'curl', label: 'cURL', badge: 'BASH', icon: '⚡' },
    { id: 'js', label: 'Node.js', badge: 'FETCH', icon: '🟡' },
    { id: 'python', label: 'Python', badge: 'REQUESTS', icon: '🐍' },
    { id: 'php', label: 'PHP', badge: 'CURL', icon: '🐘' },
  ]

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-indigo-400">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white p-1">
                <img src="/IPN.svg" alt="InstaPay" className="h-full w-full object-contain" />
              </div>
              <span className="text-white tracking-tight font-black">InstaPay <span className="text-indigo-400">Docs</span></span>
            </Link>
            <span className="hidden h-5 w-px bg-slate-800 sm:inline-block"></span>
            <span className="hidden text-xs text-slate-400 font-medium sm:inline-block">{t.navTitle}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Enhanced Language Switcher Button */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  lang === 'en'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch documentation to English"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>English</span>
              </button>
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  lang === 'ar'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="التحويل للغة العربية"
              >
                <span>العربية</span>
                <span className="text-[10px] opacity-80">🇪🇬</span>
              </button>
            </div>

            <Link href="/dashboard">
              <Button variant="outline" className="h-9 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl text-xs">
                {t.merchantConsole}
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
                  <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> {t.gettingStarted}
                </h4>
                <ul className={`mt-3 space-y-2.5 ${isRtl ? 'pr-6' : 'pl-6'} text-sm text-slate-400`}>
                  <li>
                    <a href="#overview" className="hover:text-indigo-400 transition-colors">{t.overview}</a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="hover:text-indigo-400 transition-colors">{t.howItWorks}</a>
                  </li>
                  <li>
                    <a href="#auth" className="hover:text-indigo-400 transition-colors">{t.auth}</a>
                  </li>
                  <li>
                    <a href="#production-checklist" className="hover:text-indigo-400 transition-colors">{t.productionChecklist}</a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Terminal className="h-3.5 w-3.5 text-indigo-400" /> {t.apiReference}
                </h4>
                <ul className={`mt-3 space-y-2.5 ${isRtl ? 'pr-6' : 'pl-6'} text-sm text-slate-400`}>
                  <li>
                    <a href="#create-checkout" className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">POST</span> {t.createCheckout}
                    </a>
                  </li>
                  <li>
                    <a href="#check-status" className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">GET</span> {t.checkStatus}
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Webhook className="h-3.5 w-3.5 text-indigo-400" /> {t.webhookIntegration}
                </h4>
                <ul className={`mt-3 space-y-2.5 ${isRtl ? 'pr-6' : 'pl-6'} text-sm text-slate-400`}>
                  <li>
                    <a href="#webhooks" className="hover:text-indigo-400 transition-colors">{t.webhookCallbacks}</a>
                  </li>
                  <li>
                    <a href="#signature" className="hover:text-indigo-400 transition-colors">{t.signatureValidation}</a>
                  </li>
                  <li>
                    <a href="#retry-policy" className="hover:text-indigo-400 transition-colors">{t.retryPolicy}</a>
                  </li>
                  <li>
                    <a href="#errors" className="hover:text-indigo-400 transition-colors">{t.errorsAndLimits}</a>
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
                {t.heroTitle}
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed">
                {t.heroDesc}
              </p>

              <div className="grid gap-6 sm:grid-cols-3 mt-8">
                <div className="p-5 bg-slate-900/50 border border-slate-900 rounded-xl space-y-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Layers className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-white">{t.simpleApiTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.simpleApiDesc}</p>
                </div>
                <div className="p-5 bg-slate-900/50 border border-slate-900 rounded-xl space-y-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Globe className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-white">{t.webhookDeliveryTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.webhookDeliveryDesc}</p>
                </div>
                <div className="p-5 bg-slate-900/50 border border-slate-900 rounded-xl space-y-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Lock className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-white">{t.hmacTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.hmacDesc}</p>
                </div>
              </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">{t.howItWorks}</h2>
              <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-xl space-y-6">
                <div className="flex gap-4 items-start">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">1</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{t.step1Title}</h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{t.step1Desc}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">2</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{t.step2Title}</h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{t.step2Desc}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">3</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{t.step3Title}</h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{t.step3Desc}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Authentication Section */}
            <section id="auth" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">{t.auth}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t.authDesc}
              </p>
              <div dir="ltr" className="p-4 bg-slate-950 border border-slate-900 rounded-lg flex items-center justify-between">
                <code className="text-xs text-indigo-400 font-mono">Authorization: Bearer ipk_live_xxxxxxxxxxxxxxxxxxxxxxxx</code>
                <button
                  onClick={() => handleCopy('Authorization: Bearer ipk_live_xxxxxxxxxxxxxxxxxxxxxxxx', 'auth')}
                  className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded"
                >
                  {copiedId === 'auth' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-6 text-amber-100">
                {t.authWarning}
              </div>
            </section>

            {/* Production Checklist */}
            <section id="production-checklist" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">{t.productionChecklist}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {t.checklistItems.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-900 bg-slate-900/30 p-3 text-xs text-slate-300 flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* API References */}
            <section id="create-checkout" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md">POST</span>
                <h2 className="text-2xl font-bold text-white">{t.createCheckout}</h2>
              </div>
              <p className="text-slate-400 text-sm">
                {t.createCheckoutDesc}
              </p>
              <div dir="ltr" className="p-3 bg-slate-950 border border-slate-900 rounded-md">
                <code className="text-xs text-slate-300 font-mono">POST /api/v1/checkout/create</code>
              </div>

              {/* Enhanced Snippets with Language Selector Tabs */}
              <div className="border border-slate-900 rounded-2xl bg-slate-950 overflow-hidden shadow-2xl">
                <div dir="ltr" className="flex items-center justify-between border-b border-slate-900 bg-slate-900/50 p-2 overflow-x-auto gap-2">
                  <div className="flex items-center gap-1.5">
                    {snippetTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedSnippetTab(tab.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                          selectedSnippetTab === tab.id
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-[1.02]'
                            : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800/60'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          selectedSnippetTab === tab.id ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {tab.badge}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleCopy(snippets[selectedSnippetTab], 'snippet')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-semibold shrink-0 transition-colors"
                  >
                    {copiedId === 'snippet' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-xs">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy snippet</span>
                      </>
                    )}
                  </button>
                </div>
                <div dir="ltr" className="relative p-5">
                  <pre className="text-xs text-slate-200 overflow-x-auto font-mono leading-relaxed">
                    {snippets[selectedSnippetTab]}
                  </pre>
                </div>
              </div>

              {/* Params list */}
              <div className="space-y-4">
                <h4 className="font-semibold text-white text-sm">{t.reqBodyParams}</h4>
                <div className="border border-slate-900 rounded-xl overflow-x-auto text-sm">
                  <div className="min-w-[680px] grid grid-cols-4 bg-slate-900/40 p-3 border-b border-slate-900 text-xs font-semibold text-slate-400">
                    <div>{t.fieldCol}</div>
                    <div>{t.typeCol}</div>
                    <div>{t.reqCol}</div>
                    <div>{t.descCol}</div>
                  </div>
                  <div className="min-w-[680px] grid grid-cols-4 p-3 border-b border-slate-900">
                    <div className="font-mono text-indigo-400" dir="ltr">amountEgp</div>
                    <div className="text-slate-500 font-mono" dir="ltr">number</div>
                    <div className="text-emerald-500 font-bold">{lang === 'ar' ? 'نعم' : 'Yes'}</div>
                    <div className="text-slate-400 text-xs">{t.amountDesc}</div>
                  </div>
                  <div className="min-w-[680px] grid grid-cols-4 p-3 border-b border-slate-900">
                    <div className="font-mono text-indigo-400" dir="ltr">senderHandle</div>
                    <div className="text-slate-500 font-mono" dir="ltr">string</div>
                    <div className="text-emerald-500 font-bold">{lang === 'ar' ? 'نعم' : 'Yes'}</div>
                    <div className="text-slate-400 text-xs">{t.senderDesc}</div>
                  </div>
                  <div className="min-w-[680px] grid grid-cols-4 p-3">
                    <div className="font-mono text-indigo-400" dir="ltr">note</div>
                    <div className="text-slate-500 font-mono" dir="ltr">string</div>
                    <div className="text-slate-500">{lang === 'ar' ? 'اختياري' : 'No'}</div>
                    <div className="text-slate-400 text-xs">{t.noteDesc}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-white text-sm">{t.successResponse}</h4>
                <pre dir="ltr" className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950 p-4 text-xs leading-6 text-slate-300 font-mono">{createCheckoutResponse}</pre>
                <p className="text-xs leading-6 text-slate-400">
                  {t.deepLinkNote}
                </p>
              </div>
            </section>

            {/* Check Status Section */}
            <section id="check-status" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-md">GET</span>
                <h2 className="text-2xl font-bold text-white">{t.checkStatus}</h2>
              </div>
              <p className="text-slate-400 text-sm">
                {t.checkStatusDesc}
              </p>
              <div dir="ltr" className="p-3 bg-slate-950 border border-slate-900 rounded-md">
                <code className="text-xs text-slate-300 font-mono">GET /api/v1/checkout/status?sessionId=YOUR_SESSION_ID</code>
              </div>

              {/* Params list */}
              <div className="space-y-4">
                <h4 className="font-semibold text-white text-sm">{t.queryParams}</h4>
                <div className="border border-slate-900 rounded-xl overflow-x-auto text-sm">
                  <div className="min-w-[680px] grid grid-cols-4 bg-slate-900/40 p-3 border-b border-slate-900 text-xs font-semibold text-slate-400">
                    <div>{t.fieldCol}</div>
                    <div>{t.typeCol}</div>
                    <div>{t.reqCol}</div>
                    <div>{t.descCol}</div>
                  </div>
                  <div className="min-w-[680px] grid grid-cols-4 p-3">
                    <div className="font-mono text-indigo-400" dir="ltr">sessionId</div>
                    <div className="text-slate-500 font-mono" dir="ltr">string</div>
                    <div className="text-emerald-500 font-bold">{lang === 'ar' ? 'نعم' : 'Yes'}</div>
                    <div className="text-slate-400 text-xs">{t.sessionParamDesc}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-white text-sm">{t.statusValues}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {statusRows.map(([status, _]) => (
                    <div key={status} className="rounded-xl border border-slate-900 bg-slate-900/30 p-3">
                      <div className="font-mono text-xs font-bold text-indigo-300" dir="ltr">{status}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">
                        {t.statusDescriptions[status] || status}
                      </div>
                    </div>
                  ))}
                </div>
                <h4 className="font-semibold text-white text-sm">{t.successResponse}</h4>
                <pre dir="ltr" className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950 p-4 text-xs leading-6 text-slate-300 font-mono">{statusResponse}</pre>
              </div>
            </section>

            {/* Webhooks Section */}
            <section id="webhooks" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">{t.webhookCallbacks}</h2>
              <p className="text-slate-400 text-sm">
                {t.webhooksDesc}
              </p>
              <div className="p-5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl space-y-2">
                <h4 className="font-semibold text-indigo-400 text-sm">{t.webhookEventPayload}</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {t.webhookDeliveryNote}
                </p>
              </div>
              <pre dir="ltr" className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950 p-4 text-xs leading-6 text-slate-300 font-mono">{webhookPayload}</pre>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['X-Instapay-Event-Id', lang === 'ar' ? 'معرف فريد للحدث، احفظه لتفادي التكرار.' : 'Unique event identifier. Store it to ignore duplicate deliveries.'],
                  ['X-Instapay-Timestamp', lang === 'ar' ? 'طابع زمني رقمي مستخدم في بناء التوقيع.' : 'Unix timestamp used in the signature base string.'],
                  ['X-Instapay-Signature-Version', lang === 'ar' ? 'إصدار التوقيع الحالي: v1.' : 'Current value: v1.'],
                  ['X-Instapay-Signature', 'v1=HMAC_SHA256(timestamp.rawBody, webhookSecret)'],
                ].map(([name, description]) => (
                  <div key={name} className="rounded-xl border border-slate-900 bg-slate-900/30 p-3">
                    <code className="text-xs text-indigo-300 font-mono" dir="ltr">{name}</code>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Webhook Signature Validation */}
            <section id="signature" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-bold text-white">{t.signatureValidation}</h2>
              <p className="text-slate-400 text-sm">
                {t.signatureValidationDesc}
              </p>
              <div className={`space-y-3 text-sm ${isRtl ? 'pr-4 border-r-2' : 'pl-4 border-l-2'} border-indigo-500`}>
                <div className="text-slate-300"><code className="text-indigo-400 font-mono" dir="ltr">X-Instapay-Timestamp</code>: {lang === 'ar' ? 'طابع الطلب الزمني. ارفض الطلبات الأقدم من ٥ دقائق لتفادي هجمات إعادة الإرسال.' : 'Request timestamp. Reject requests older than 5 minutes to prevent replay attacks.'}</div>
                <div className="text-slate-300"><code className="text-indigo-400 font-mono" dir="ltr">X-Instapay-Signature</code>: {lang === 'ar' ? 'صيغته v1=<signature> ويحسب عبر HMAC-SHA256(timestamp + "." + rawBody, secret).' : 'Formatted as v1=<signature>. Computes as HMAC-SHA256(timestamp + "." + rawBody, webhookSecret).'}</div>
              </div>

              {/* Express JS Signature Verification Snippet */}
              <div className="border border-slate-900 rounded-2xl bg-slate-950 overflow-hidden shadow-xl">
                <div dir="ltr" className="flex items-center justify-between border-b border-slate-900 bg-slate-900/50 px-4 py-3 text-xs font-semibold text-indigo-400 font-mono">
                  <span>EXPRESS WEBHOOK HANDLER</span>
                  <button
                    onClick={() => handleCopy(expressSnippet, 'express')}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800"
                  >
                    {copiedId === 'express' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div dir="ltr" className="p-5">
                  <pre className="text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed max-h-[450px]">
                    {expressSnippet}
                  </pre>
                </div>
              </div>
            </section>

            {/* Webhook Retry Policy */}
            <section id="retry-policy" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">{t.retryPolicy}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t.retryPolicyDesc}
              </p>
              <div className="grid gap-4 sm:grid-cols-5 text-center text-xs mt-4">
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-xl">
                  <div className="font-semibold text-white">{lang === 'ar' ? 'فوري' : 'Initial'}</div>
                  <div className="text-indigo-400 font-mono mt-1">{lang === 'ar' ? 'مباشرة' : 'Immediate'}</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-xl">
                  <div className="font-semibold text-white">{lang === 'ar' ? 'محاولة ١' : 'Retry 1'}</div>
                  <div className="text-indigo-400 font-mono mt-1">~5 mins</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-xl">
                  <div className="font-semibold text-white">{lang === 'ar' ? 'محاولة ٢' : 'Retry 2'}</div>
                  <div className="text-indigo-400 font-mono mt-1">27 mins</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-xl">
                  <div className="font-semibold text-white">{lang === 'ar' ? 'محاولة ٣' : 'Retry 3'}</div>
                  <div className="text-indigo-400 font-mono mt-1">81 mins</div>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-xl">
                  <div className="font-semibold text-white">{lang === 'ar' ? 'محاولة ٤' : 'Retry 4'}</div>
                  <div className="text-rose-400 font-mono mt-1">243 mins</div>
                </div>
              </div>
            </section>

            <section id="errors" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-bold text-white">{t.errorsAndLimits}</h2>
              <p className="text-sm leading-6 text-slate-400">
                {t.errorsDesc}
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-900 text-sm">
                <div className="min-w-[760px] grid grid-cols-3 border-b border-slate-900 bg-slate-900/40 p-3 text-xs font-semibold text-slate-400">
                  <div>{t.httpCol}</div>
                  <div>{t.meaningCol}</div>
                  <div>{t.actionCol}</div>
                </div>
                {errorRows.map(([code, meaning, action]) => (
                  <div key={code} className="min-w-[760px] grid grid-cols-3 border-b border-slate-900 p-3 last:border-b-0">
                    <div className="font-mono text-indigo-300" dir="ltr">{code}</div>
                    <div className="text-slate-300">{meaning}</div>
                    <div className="text-xs leading-5 text-slate-400">{action}</div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-24 border-t border-slate-900 bg-slate-950 py-10 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <p>&copy; {new Date().getFullYear()} {t.footerCopyright}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <a href="https://wa.me/201114671033" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 font-semibold">
              💬 WhatsApp: +201114671033
            </a>
            <span>•</span>
            <a href="mailto:instapay.payment.gateway@gmail.com" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              ✉️ instapay.payment.gateway@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
