import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { authenticateByApiKey, signPayload } from '@/lib/auth'
import { isAllowedWebhookUrl } from '@/lib/webhook'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const client = await authenticateByApiKey(request)
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      targetUrl = client.webhookUrl,
      event = 'payment.confirmed',
      amountEgp = 150.00,
      senderHandle = 'customer@instapay',
      note = 'Test Payment Simulation #999',
    } = body || {}

    const url = String(targetUrl || '').trim()
    if (!url) {
      return NextResponse.json({ ok: false, error: 'No webhook URL provided or configured.' }, { status: 400 })
    }

    if (!isAllowedWebhookUrl(url)) {
      return NextResponse.json({ ok: false, error: 'Webhook URL must be a public HTTPS endpoint.' }, { status: 400 })
    }

    const eventId = `test_evt_${crypto.randomUUID().slice(0, 12)}`
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const mockPayload = {
      id: eventId,
      created: Number(timestamp),
      event,
      clientId: client.id,
      businessName: client.businessName,
      isSimulation: true,
      transaction: {
        sessionId: `test_sess_${crypto.randomBytes(8).toString('hex')}`,
        senderHandle,
        recipientHandle: client.instapayHandle,
        amountEgp: Number(amountEgp),
        detectedAmountEgp: Number(amountEgp),
        currency: 'EGP',
        status: event === 'payment.underpaid' ? 'UNDERPAID' : 'CONFIRMED',
        detectedRef: `SIM-REF-${Date.now().toString().slice(-6)}`,
        detectedAt: new Date().toISOString(),
        note,
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
    }

    const bodyStr = JSON.stringify(mockPayload, null, 2)
    const rawPayloadOneLine = JSON.stringify(mockPayload)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Instapay-Detector-Gateway/2.0-TestSimulator',
      'X-Instapay-Event-Id': eventId,
      'X-Instapay-Timestamp': timestamp,
      'X-Instapay-Signature-Version': 'v1',
    }

    let calculatedSignature = ''
    if (client.webhookSecret) {
      calculatedSignature = await signPayload(`${timestamp}.${rawPayloadOneLine}`, client.webhookSecret)
      headers['X-Instapay-Signature'] = `v1=${calculatedSignature}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let res: Response
    let responseText = ''
    let roundtripLatencyMs = 0

    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: rawPayloadOneLine,
        signal: controller.signal,
      })
      roundtripLatencyMs = Date.now() - startTime
      responseText = (await res.text()).slice(0, 1500)
    } catch (fetchErr) {
      roundtripLatencyMs = Date.now() - startTime
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Connection failed or timeout'
      return NextResponse.json({
        ok: true,
        testResult: {
          isSuccess: false,
          statusCode: null,
          statusText: 'Network Error',
          responseBody: errMsg,
          roundtripLatencyMs,
          sentUrl: url,
          sentHeaders: headers,
          sentPayload: mockPayload,
          secretUsed: Boolean(client.webhookSecret),
        },
      })
    } finally {
      clearTimeout(timeout)
    }

    return NextResponse.json({
      ok: true,
      testResult: {
        isSuccess: res.ok,
        statusCode: res.status,
        statusText: res.statusText,
        responseBody: responseText || '(Empty Response)',
        roundtripLatencyMs,
        sentUrl: url,
        sentHeaders: headers,
        sentPayload: mockPayload,
        secretUsed: Boolean(client.webhookSecret),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: `Simulation failed: ${message}` },
      { status: 500 }
    )
  }
}
