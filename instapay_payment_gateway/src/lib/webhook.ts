import crypto from 'crypto'
import { db } from './db'
import { signPayload } from './auth'

export function isAllowedWebhookUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (!['https:', 'http:'].includes(url.protocol)) return false
    if (url.protocol === 'http:' && process.env.ALLOW_HTTP_WEBHOOKS !== '1') return false

    const hostname = url.hostname.toLowerCase()
    
    // Explicit Cloud Metadata & Loopback Hostnames
    if (
      hostname === 'localhost' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return process.env.ALLOW_PRIVATE_WEBHOOKS === '1'
    }

    // Block Private IPv4, Link-Local (Cloud Metadata), and Reserved Ranges
    const isPrivateOrCloudMetadataIpv4 =
      hostname === '0.0.0.0' ||
      hostname.startsWith('127.') ||            // Loopback (127.0.0.0/8)
      hostname.startsWith('10.') ||             // Class A Private (10.0.0.0/8)
      hostname.startsWith('192.168.') ||        // Class C Private (192.168.0.0/16)
      hostname.startsWith('169.254.') ||        // Link-Local & Cloud Metadata (169.254.0.0/16, e.g. 169.254.169.254)
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) || // Class B Private (172.16.0.0/12)
      hostname.startsWith('100.64.') ||         // Carrier-Grade NAT (100.64.0.0/10)
      /^2(2[4-9]|[3-5][0-9])\./.test(hostname)  // Multicast & Reserved (224.0.0.0/4)

    // Block IPv6 Loopback, Link-Local, and Unique Local
    const isPrivateIpv6 =
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.startsWith('[fe80:') ||          // Link-Local (fe80::/10)
      hostname.startsWith('[fc00:') ||          // Unique Local (fc00::/7)
      hostname.startsWith('[fd00:')

    if (isPrivateOrCloudMetadataIpv4 || isPrivateIpv6) {
      return process.env.ALLOW_PRIVATE_WEBHOOKS === '1'
    }

    // Block dangerous internal ports
    if (url.port) {
      const portNum = Number(url.port)
      const dangerousPorts = [21, 22, 23, 25, 53, 110, 143, 3306, 5432, 6379, 11211, 27017, 28017]
      if (dangerousPorts.includes(portNum)) {
        return false
      }
    }

    return true
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

export async function retryWebhook(logId: string) {
  const log = await db.webhookLog.findUnique({
    where: { id: logId },
    include: {
      client: {
        select: {
          webhookSecret: true
        }
      }
    }
  })
  if (!log || log.isSuccess || log.attempt >= 5) return

  const attempt = log.attempt + 1
  let statusCode: number | null = null
  let responseText = ''
  let isSuccess = false
  let nextAttemptAt: Date | null = null

  const timestamp = Math.floor(Date.now() / 1000).toString()

  try {
    if (!isAllowedWebhookUrl(log.url)) {
      throw new Error('Webhook URL is not allowed. Use a public HTTPS endpoint.')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Instapay-Detector-Gateway/2.0',
      'X-Instapay-Event-Id': log.eventId || crypto.randomUUID(),
      'X-Instapay-Timestamp': timestamp,
      'X-Instapay-Signature-Version': 'v1',
    }

    if (log.client.webhookSecret) {
      const signature = await signPayload(`${timestamp}.${log.payload}`, log.client.webhookSecret)
      headers['X-Instapay-Signature'] = `v1=${signature}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let res: Response
    try {
      res = await fetch(log.url, {
        method: 'POST',
        headers,
        body: log.payload,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    statusCode = res.status
    isSuccess = res.ok
    responseText = (await res.text()).slice(0, 1000)
  } catch (err) {
    responseText = err instanceof Error ? err.message : 'Connection failed'
    const backoffMs = Math.pow(3, attempt) * 60 * 1000
    nextAttemptAt = new Date(Date.now() + backoffMs)
  } finally {
    if (!isSuccess && !nextAttemptAt) {
      const backoffMs = Math.pow(3, attempt) * 60 * 1000
      nextAttemptAt = new Date(Date.now() + backoffMs)
    }

    await db.webhookLog.update({
      where: { id: log.id },
      data: {
        statusCode,
        response: responseText,
        isSuccess,
        attempt,
        nextAttemptAt: isSuccess ? null : (attempt >= 5 ? null : nextAttemptAt),
      }
    })
  }
}

