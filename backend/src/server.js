import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import crypto from 'node:crypto'
import { db } from './db.js'
import {
  clearExpiredSessions,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionFromRequest,
  sessionCookie,
  verifyPassword,
} from './auth.js'
import { getSystemHealthReport, getTelemetrySnapshot } from './telemetry.js'

const app = Fastify({ logger: false })
const host = process.env.MONITOR_API_HOST || '127.0.0.1'
const port = Number(process.env.MONITOR_API_PORT || 4180)
const allowedOrigin = process.env.MONITOR_ALLOWED_ORIGIN || 'http://127.0.0.1:4174'
const secureCookie = process.env.MONITOR_COOKIE_SECURE === 'true'
const sessionSecret = process.env.MONITOR_SESSION_SECRET || crypto.randomBytes(32).toString('hex')
void sessionSecret

function startupCheck() {
  const warnings = []
  if (!process.env.MONITOR_SESSION_SECRET || process.env.MONITOR_SESSION_SECRET === 'change-this-to-a-long-random-secret') {
    warnings.push('MONITOR_SESSION_SECRET is using a temporary or default value.')
  }
  if (!secureCookie) {
    warnings.push('MONITOR_COOKIE_SECURE=false; use true behind HTTPS/Tailscale serve.')
  }
  return warnings
}

await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
})

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin || origin === allowedOrigin) return cb(null, true)
    return cb(new Error('Origin not allowed'), false)
  },
  credentials: true,
})

await app.register(rateLimit, {
  global: true,
  max: 60,
  timeWindow: '1 minute',
})

app.decorateRequest('authSession', null)
app.addHook('preHandler', async (req) => {
  req.authSession = getSessionFromRequest(req)
})

function requireAuth(req, reply) {
  if (!req.authSession) {
    reply.code(401).send({ error: 'unauthorized' })
    return false
  }
  return true
}

app.get('/health', async () => {
  const report = await getSystemHealthReport()
  return report
})

app.get('/health/ready', async (req, reply) => {
  const report = await getSystemHealthReport()
  if (!report.ok) {
    return reply.code(503).send(report)
  }
  return report
})

app.post('/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    return reply.code(400).send({ error: 'invalid_payload' })
  }

  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username)
  if (!user) {
    return reply.code(401).send({ error: 'invalid_credentials' })
  }

  const valid = await verifyPassword(user.password_hash, password)
  if (!valid) {
    return reply.code(401).send({ error: 'invalid_credentials' })
  }

  const session = createSession(user.id)
  reply.header('set-cookie', sessionCookie(session.id, secureCookie))
  return { ok: true, username: user.username }
})

app.post('/auth/logout', async (req, reply) => {
  const session = req.authSession
  if (session) destroySession(session.id)
  reply.header('set-cookie', clearSessionCookie(secureCookie))
  return { ok: true }
})

app.get('/auth/me', async (req, reply) => {
  if (!req.authSession) return reply.code(401).send({ error: 'unauthorized' })
  return { ok: true, username: req.authSession.username }
})

app.get('/api/telemetry/snapshot', async (req, reply) => {
  if (!requireAuth(req, reply)) return
  const snapshot = await getTelemetrySnapshot()
  return snapshot
})

app.setErrorHandler((error, req, reply) => {
  req.log?.error?.(error)
  const code = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500
  reply.code(code).send({ error: code === 500 ? 'internal_error' : error.message })
})

const startupWarnings = startupCheck()
const expiredSessionsCleared = clearExpiredSessions()
if (expiredSessionsCleared > 0) {
  console.log(`openclaw-monitor-api cleared ${expiredSessionsCleared} expired session(s) on startup`)
}
for (const warning of startupWarnings) {
  console.warn(`openclaw-monitor-api startup warning: ${warning}`)
}

app.listen({ host, port }).then(() => {
  console.log(`openclaw-monitor-api listening on http://${host}:${port}`)
})
