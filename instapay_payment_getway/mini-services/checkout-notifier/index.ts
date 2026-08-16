import { createServer, IncomingMessage, ServerResponse } from 'http'
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
 * Routing note: socket.io attaches its own request listener to the httpServer
 * when constructed with `path: '/'`. That listener intercepts ALL requests,
 * which would break our /health and /emit routes. We work around this by
 * capturing socket.io's listener after construction, removing it, and
 * installing our own dispatcher that calls our routes first and falls through
 * to socket.io's listener for everything else (engine.io handshakes).
 */

// Render assigns a port via the PORT env var. For local dev, default to 3003
// so it doesn't conflict with the Next.js dev server on 3000.
const PORT = Number(process.env.PORT) || 3003

// Create the httpServer with a placeholder handler — we'll set the real one
// after socket.io is attached and we've captured its listener.
const httpServer = createServer((_req, res) => {
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Not ready' }))
})

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards socket.io traffic on path "/"
  // to this port based on the XTransformPort query parameter.
  path: '/',
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

// Capture socket.io's request listener (the one it just attached) and replace
// the server's request handler with our dispatcher.
const socketIoListeners = httpServer.listeners('request').slice() as Array<
  (req: IncomingMessage, res: ServerResponse) => void
>
httpServer.removeAllListeners('request')

httpServer.addListener('request', (req: IncomingMessage, res: ServerResponse) => {
  // Strip the query string for route matching — Caddy adds XTransformPort
  // as a query param, which would break exact URL comparisons.
  const urlPath = (req.url || '').split('?')[0]

  // --- Our routes ---
  if (req.method === 'GET' && urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'checkout-notifier', port: PORT }))
    return
  }

  if (req.method === 'POST' && urlPath === '/emit') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const payload = JSON.parse(body) as {
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
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'sessionId is required' }))
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

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            ok: true,
            checkoutRecipients,
            dashboardRecipients,
          })
        )
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : 'Invalid JSON',
          })
        )
      }
    })
    return
  }

  // --- Fall through to socket.io for everything else (engine.io handshakes) ---
  for (const listener of socketIoListeners) {
    listener.call(httpServer, req, res)
  }
})

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

httpServer.listen(PORT, () => {
  console.log(`✓ checkout-notifier WebSocket service listening on port ${PORT}`)
  console.log(`  socket.io path: /`)
  console.log(`  internal emit endpoint: POST http://localhost:${PORT}/emit`)
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
