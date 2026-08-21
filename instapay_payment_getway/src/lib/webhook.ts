import crypto from 'crypto'
import { db } from './db'
import { signPayload } from './auth'

export function isAllowedWebhookUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (!['https:', 'http:'].includes(url.protocol)) return false
    if (url.protocol === 'http:' && process.env.ALLOW_HTTP_WEBHOOKS !== '1') return false

    const hostname = url.hostname.toLowerCase()
    const privateHost =
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)

    return !privateHost || process.env.ALLOW_PRIVATE_WEBHOOKS === '1'
  } catch {
    return false
  }
}

export async function forwardToClientWebhook(
  clientId: string,
  url: string,
  secret: string | null,
  payload: Record<string, unknown>
) {
  let statusCode: number | null = null
  let responseText = ''
  let isSuccess = false
  let nextAttemptAt: Date | null = null

  const eventId = crypto.randomUUID()
  const timestamp = Math.floor(Date.now() / 1000).toString()

  try {
    if (!isAllowedWebhookUrl(url)) {
      throw new Error('Webhook URL is not allowed. Use a public HTTPS endpoint.')
    }

    const bodyStr = JSON.stringify({
      id: eventId,
      created: Number(timestamp),
      ...payload,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Instapay-Detector-Gateway/2.0',
      'X-Instapay-Event-Id': eventId,
      'X-Instapay-Timestamp': timestamp,
      'X-Instapay-Signature-Version': 'v1',
    }

    if (secret) {
      const signature = await signPayload(`${timestamp}.${bodyStr}`, secret)
      headers['X-Instapay-Signature'] = `v1=${signature}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: bodyStr,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    statusCode = res.status
    isSuccess = res.ok
    responseText = (await res.text()).slice(0, 1000)

    if (!res.ok) {
      console.warn(`[webhook] client endpoint returned non-OK status: ${res.status}`)
    }
  } catch (err) {
    responseText = err instanceof Error ? err.message : 'Connection failed'
    nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000)
    console.error('[webhook] failed to forward to client webhook:', err)
  } finally {
    try {
      await db.webhookLog.create({
        data: {
          clientId,
          url,
          event: (payload.event as string) || 'payment.confirmed',
          eventId,
          payload: JSON.stringify({ id: eventId, created: Number(timestamp), ...payload }),
          statusCode,
          response: responseText,
          isSuccess,
          attempt: 1,
          nextAttemptAt: isSuccess ? null : nextAttemptAt ?? new Date(Date.now() + 5 * 60 * 1000),
        },
      })
    } catch (dbErr) {
      console.error('[webhook] failed to save WebhookLog to DB:', dbErr)
    }
  }
}
