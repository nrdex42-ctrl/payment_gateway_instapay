import express from 'express'
import { createServer } from 'http'
import { createHmac, timingSafeEqual } from 'crypto'
import { Server, Socket } from 'socket.io'

/**
 * Mini-service that pushes real-time checkout status updates to web clients.
 *
 * Architecture:
 *   - Web clients connect via socket.io and join a room named `checkout:<sessionId>`.
 *   - The Next.js webhook handler (src/app/api/webhooks/instapay/route.ts) sends
 *     an HTTP POST to this service's internal port (3003) at /emit when a
 *     payment is confirmed. The POST body is:
 *       { sessionId, status, amountEgp, senderHandle, detectedRef, detectedAt }
 *   - This service broadcasts an `checkout:update` event to all sockets in the
 *     matching room, and the waiting screen flips to "confirmed" instantly.
 *
 * Security:
 *   The /emit endpoint requires HMAC-SHA256 signature verification via the
 *   X-Notifier-Signature header. The gateway signs the request body using
 *   the shared DETECT_TOKEN secret. This prevents attackers from spoofing
 *   payment confirmations.
 */

// Render assigns a port via the PORT env var. For local dev, default to 3003
// so it doesn't conflict with the Next.js dev server on 3000.
const PORT = Number(process.env.PORT) || 3003
const DETECT_TOKEN = process.env.DETECT_TOKEN || ''

// ─── HMAC Signature Verification ───────────────────────────────────

/**
 * Verifies the HMAC-SHA256 signature of a request body.
 * Expected header format: X-Notifier-Signature: sha256=<hex digest>
 */
function verifySignature(body: string, signatureHeader: string | undefined): boolean {
  if (!DETECT_TOKEN) {
    // If no token is configured, reject all requests in production.
    // This forces the operator to configure DETECT_TOKEN.
    console.error('[security] DETECT_TOKEN is not configured — all /emit requests will be rejected')
    return false
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const receivedSig = signatureHeader.slice('sha256='.length)
  const expectedSig = createHmac('sha256', DETECT_TOKEN).update(body).digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(receivedSig, 'hex')
    const b = Buffer.from(expectedSig, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── Express App ───────────────────────────────────────────────────

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  // Use the default socket.io path. The original code used path: '/' which
  // made socket.io intercept ALL HTTP requests, requiring a fragile manual
  // listener dispatch hack. With the default '/socket.io', Express routes
  // (/health, /emit) work naturally and socket.io only handles its own
  // engine.io handshake traffic on /socket.io/*.
  // The client already uses the default path '/socket.io' (no path override).
  cors: {
    // In production (Render), set CORS_ORIGIN to the gateway's URL
    // (e.g. https://instapay-gateway.onrender.com) to restrict cross-origin
    // socket.io connections. Defaults to "*" for local dev.
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── HTTP Routes ───────────────────────────────────────────────────

// Health check endpoint — no auth required (used by Render health checks)
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'checkout-notifier', port: PORT })
})

// Parse raw body as text for HMAC verification, then parse as JSON
app.post('/emit', express.text({ type: 'application/json' }), (req, res) => {
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

  // ── Signature verification ──
  const signature = req.headers['x-notifier-signature'] as string | undefined
  if (!verifySignature(rawBody, signature)) {
    console.warn(`[security] Rejected /emit request — invalid or missing signature (IP: ${req.ip})`)
    res.status(401).json({ ok: false, error: 'Unauthorized: invalid signature' })
    return
  }

  // ── Parse and process ──
  try {
    const payload = JSON.parse(rawBody) as {
      sessionId: string
      status: 'CONFIRMED' | 'EXPIRED'
      amountEgp?: number
      senderHandle?: string
      detectedRef?: string | null
      detectedAt?: string | null
      // Optional: broadcast to a global room (e.g. "dashboard") so the
      // merchant dashboard app receives real-time updates.
      broadcast?: string
      event?: string
      dashboardPayload?: Record<string, unknown>
    }

    if (!payload.sessionId) {
      res.status(400).json({ ok: false, error: 'sessionId is required' })
      return
    }

    // 1. Emit to the specific checkout room (for the waiting client)
    const checkoutRoom = `checkout:${payload.sessionId}`
    io.to(checkoutRoom).emit('checkout:update', {
      sessionId: payload.sessionId,
      status: payload.status,
      amountEgp: payload.amountEgp,
      senderHandle: payload.senderHandle,
      detectedRef: payload.detectedRef,
      detectedAt: payload.detectedAt,
    })
    const checkoutRecipients = io.sockets.adapter.rooms.get(checkoutRoom)?.size ?? 0

    // 2. Optionally broadcast to the dashboard room (for the merchant app)
    let dashboardRecipients = 0
    if (payload.broadcast && payload.event && payload.dashboardPayload) {
      io.to(payload.broadcast).emit(payload.event, payload.dashboardPayload)
      dashboardRecipients =
        io.sockets.adapter.rooms.get(payload.broadcast)?.size ?? 0
    }

    console.log(
      `[emit] checkout=${checkoutRoom} (${checkoutRecipients} recipients) | ` +
        `broadcast=${payload.broadcast || 'none'} (${dashboardRecipients} recipients)`
    )

    res.json({
      ok: true,
      checkoutRecipients,
      dashboardRecipients,
    })
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON',
    })
  }
})

// ─── Socket.io Connection Handling ─────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[connect] ${socket.id}`)

  // Client asks to join a specific checkout room (for the waiting screen)
  socket.on('join', (data: { sessionId?: string }) => {
    if (!data?.sessionId || typeof data.sessionId !== 'string') {
      socket.emit('error', { message: 'sessionId is required' })
      return
    }
    const roomName = `checkout:${data.sessionId}`
    socket.join(roomName)
    console.log(`[join] ${socket.id} → ${roomName}`)
    socket.emit('joined', { sessionId: data.sessionId })
  })

  // Merchant dashboard app joins the global dashboard room to receive
  // real-time updates whenever ANY payment is confirmed.
  socket.on('join:dashboard', (data: { token?: string }) => {
    // Optional light auth: the dashboard room is read-only and only shows
    // confirmed-payment events. We don't expose sensitive data over it.
    // For stronger security, require the same DETECT_TOKEN here.
    const expectedToken = process.env.DETECT_TOKEN
    if (expectedToken && data?.token !== expectedToken) {
      socket.emit('error', { message: 'Invalid dashboard token' })
      return
    }
    socket.join('dashboard')
    console.log(`[join:dashboard] ${socket.id}`)
    socket.emit('joined:dashboard', { ok: true })
  })

  socket.on('disconnect', (reason: string) => {
    console.log(`[disconnect] ${socket.id} (${reason})`)
  })

  socket.on('error', (err: Error) => {
    console.error(`[socket-error] ${socket.id}:`, err.message)
  })
})

// ─── Start Server ──────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`✓ checkout-notifier WebSocket service listening on port ${PORT}`)
  console.log(`  socket.io path: /`)
  console.log(`  internal emit endpoint: POST http://localhost:${PORT}/emit`)
  console.log(`  DETECT_TOKEN configured: ${DETECT_TOKEN ? 'yes' : 'NO — /emit will reject all requests'}`)
})

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
