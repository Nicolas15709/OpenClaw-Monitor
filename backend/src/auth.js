import crypto from 'node:crypto'
import argon2 from 'argon2'
import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import { db } from './db.js'

const SESSION_COOKIE = 'openclaw_monitor_session'

export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
}

export async function verifyPassword(hash, password) {
  return argon2.verify(hash, password)
}

export function createSession(userId, ttlHours = 24) {
  const id = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt)
  return { id, expiresAt }
}

export function destroySession(sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function getSessionFromRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '')
  const sessionId = cookies[SESSION_COOKIE]
  if (!sessionId) return null

  const row = db.prepare(`
    SELECT s.id, s.user_id, s.expires_at, u.username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(sessionId)

  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(sessionId)
    return null
  }

  return row
}

export function sessionCookie(value, secure = false) {
  return serializeCookie(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24,
  })
}

export function clearSessionCookie(secure = false) {
  return serializeCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    expires: new Date(0),
  })
}
