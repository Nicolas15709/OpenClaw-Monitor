import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { db } from './db.js'

const execFileAsync = promisify(execFile)
const CLI_TIMEOUT_MS = Number(process.env.MONITOR_CLI_TIMEOUT_MS || 15000)

function sanitizeText(value) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_KEY]')
    .replace(/__OPENCLAW_REDACTED__/g, '[REDACTED]')
    .replace(/token\s*[:=]\s*[^\s]+/gi, 'token=[REDACTED]')
}

async function runOpenClaw(args) {
  const { stdout } = await execFileAsync('openclaw', args, {
    maxBuffer: 1024 * 1024 * 4,
    timeout: CLI_TIMEOUT_MS,
  })
  return sanitizeText(stdout)
}

async function runOpenClawJson(args) {
  const { stdout } = await execFileAsync('openclaw', args, {
    maxBuffer: 1024 * 1024 * 4,
    timeout: CLI_TIMEOUT_MS,
  })
  return JSON.parse(stdout)
}

async function runCheck(name, runner) {
  const startedAt = Date.now()
  try {
    const value = await runner()
    return {
      name,
      ok: true,
      durationMs: Date.now() - startedAt,
      value,
    }
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: sanitizeText(error?.message || 'unknown_error'),
    }
  }
}

function formatAgeFromMs(ageMs) {
  if (ageMs == null) return 'unknown'
  const minutes = Math.floor(Number(ageMs) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} d ago`
}

function formatFutureFromMs(timestampMs) {
  if (!timestampMs) return 'scheduled'
  const diff = Number(timestampMs) - Date.now()
  if (diff <= 0) return 'due now'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return remMinutes ? `in ${hours}h ${remMinutes}m` : `in ${hours}h`
}

function classifySession(session) {
  const key = String(session.key || '')
  if (key.includes(':telegram:')) return 'telegram'
  if (key.includes(':cron:')) return 'cron'
  if (key.includes(':subagent:')) return 'subagent'
  if (key === 'agent:main:main') return 'main'
  return session.kind || 'session'
}

function mapSession(session) {
  const contextPct = session.contextTokens ? Math.min(100, Math.round((session.totalTokens / session.contextTokens) * 100)) : 0
  const active = Number(session.ageMs || 0) < 1000 * 60 * 20
  return {
    id: session.key,
    title: session.key === 'agent:main:main' ? 'Main session' : session.key,
    kind: classifySession(session),
    state: active ? 'active' : 'idle',
    model: session.model || 'unknown',
    tokens: session.totalTokens || 0,
    contextPct,
    updatedAt: formatAgeFromMs(session.ageMs),
    summary: `agent ${session.agentId || 'n/a'} · input ${session.inputTokens || 0} · output ${session.outputTokens || 0}`,
  }
}

function mapCronJob(job) {
  return {
    id: job.name || job.id,
    enabled: Boolean(job.enabled),
    status: job.state?.lastRunStatus || job.state?.lastStatus || 'unknown',
    nextRun: formatFutureFromMs(job.state?.nextRunAtMs),
    lastRun: job.state?.lastRunStatus || 'n/a',
    detail: job.state?.lastError ? sanitizeText(job.state.lastError) : `delivery ${job.state?.lastDeliveryStatus || 'n/a'} · ${job.sessionTarget || 'n/a'}`,
  }
}

function buildOverview(statusText, sessions, cronJobs, checks) {
  const activeSessions = sessions.filter((s) => s.state === 'active').length
  const totalVisibleTokens = sessions.reduce((sum, s) => sum + (s.tokens || 0), 0)
  const errors = cronJobs.filter((j) => j.status === 'error').length
  const mainKind = sessions.find((s) => s.kind === 'main')?.kind || sessions[0]?.kind || 'unknown'
  const failedChecks = checks.filter((check) => !check.ok).length

  return {
    status: failedChecks === 0 && /reachable|running/i.test(statusText) ? 'online' : failedChecks === checks.length ? 'offline' : 'degraded',
    runtime: 'OpenClaw main',
    channel: mainKind,
    activeSessions,
    activeTasks: activeSessions,
    errors,
    totalVisibleTokens,
  }
}

function buildTimeline(statusText, cronJobs, sessions) {
  const items = []
  if (/Telegram\s+ON|telegram/i.test(statusText)) {
    items.push({ id: 'status-telegram', type: 'ok', time: 'now', text: 'Telegram channel visible in current status output.' })
  }
  if (/Dashboard/i.test(statusText)) {
    items.push({ id: 'status-dashboard', type: 'ok', time: 'now', text: 'Gateway dashboard reachable from current host.' })
  }
  for (const session of sessions.slice(0, 3)) {
    items.push({ id: `sess-${session.id}`, type: session.state === 'active' ? 'run' : 'patch', time: session.updatedAt, text: `${session.title} · ${session.summary}` })
  }
  for (const job of cronJobs.slice(0, 3)) {
    items.push({ id: `cron-${job.id}`, type: job.status === 'error' ? 'fix' : 'ok', time: 'recent', text: `${job.id} · ${job.detail}` })
  }
  return items.slice(0, 10)
}

function getDbHealth() {
  try {
    const row = db.prepare('SELECT 1 AS ok').get()
    return {
      ok: row?.ok === 1,
      engine: 'sqlite',
      sessionCount: db.prepare('SELECT COUNT(*) AS count FROM sessions').get()?.count || 0,
      userCount: db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count || 0,
    }
  } catch (error) {
    return {
      ok: false,
      engine: 'sqlite',
      error: sanitizeText(error?.message || 'db_unavailable'),
    }
  }
}

function summarizeChecks(checks) {
  return checks.map((check) => ({
    name: check.name,
    ok: check.ok,
    durationMs: check.durationMs,
    error: check.ok ? undefined : check.error,
  }))
}

export async function getTelemetrySnapshot() {
  const checks = await Promise.all([
    runCheck('openclaw_status', () => runOpenClaw(['status'])),
    runCheck('openclaw_sessions', () => runOpenClawJson(['sessions', '--json', '--all-agents'])),
    runCheck('openclaw_cron', () => runOpenClawJson(['cron', 'list', '--json'])),
  ])

  const statusText = checks.find((check) => check.name === 'openclaw_status')?.value || ''
  const sessionsResult = checks.find((check) => check.name === 'openclaw_sessions')?.value || { sessions: [] }
  const cronResult = checks.find((check) => check.name === 'openclaw_cron')?.value || { jobs: [] }

  const rawSessions = Array.isArray(sessionsResult?.sessions) ? sessionsResult.sessions : []
  const rawCron = Array.isArray(cronResult?.jobs) ? cronResult.jobs : []

  const activeWork = rawSessions
    .filter((session) => !String(session.key || '').includes(':run:'))
    .slice(0, 8)
    .map(mapSession)

  const cron = rawCron.slice(0, 8).map(mapCronJob)
  const overview = buildOverview(statusText, activeWork, cron, checks)
  const timeline = buildTimeline(statusText, cron, activeWork)

  return {
    generatedAt: new Date().toISOString(),
    source: 'openclaw-cli',
    overview,
    activeWork,
    cron,
    timeline,
    statusText,
    healthChecks: summarizeChecks(checks),
    warnings: [
      'Telemetry is sanitized and read-only.',
      'Sensitive values are redacted before returning to the frontend.',
    ],
  }
}

export async function getSystemHealthReport() {
  const [statusCheck, sessionsCheck, cronCheck] = await Promise.all([
    runCheck('openclaw_status', () => runOpenClaw(['status'])),
    runCheck('openclaw_sessions', () => runOpenClawJson(['sessions', '--json', '--all-agents'])),
    runCheck('openclaw_cron', () => runOpenClawJson(['cron', 'list', '--json'])),
  ])

  const dbHealth = getDbHealth()
  const checks = [
    {
      name: 'database',
      ok: dbHealth.ok,
      durationMs: 0,
      error: dbHealth.ok ? undefined : dbHealth.error,
    },
    statusCheck,
    sessionsCheck,
    cronCheck,
  ]

  const sessions = Array.isArray(sessionsCheck.value?.sessions) ? sessionsCheck.value.sessions : []
  const jobs = Array.isArray(cronCheck.value?.jobs) ? cronCheck.value.jobs : []
  const cronErrors = jobs.filter((job) => (job.state?.lastRunStatus || job.state?.lastStatus) === 'error').length
  const activeSessions = sessions.filter((session) => Number(session.ageMs || 0) < 1000 * 60 * 20).length
  const failedChecks = checks.filter((check) => !check.ok)

  return {
    ok: failedChecks.length === 0,
    status: failedChecks.length === 0 ? 'ok' : failedChecks.length === checks.length ? 'offline' : 'degraded',
    generatedAt: new Date().toISOString(),
    summary: {
      activeSessions,
      configuredCronJobs: jobs.length,
      cronErrors,
      users: dbHealth.userCount || 0,
      sessionsStored: dbHealth.sessionCount || 0,
    },
    checks: summarizeChecks(checks),
  }
}
