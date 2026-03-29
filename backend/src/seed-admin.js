import 'dotenv/config'
import { db } from './db.js'
import { hashPassword } from './auth.js'

const username = process.env.MONITOR_ADMIN_USERNAME
const password = process.env.MONITOR_ADMIN_PASSWORD

if (!username || !password) {
  console.error('Missing MONITOR_ADMIN_USERNAME or MONITOR_ADMIN_PASSWORD')
  process.exit(1)
}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
if (existing) {
  console.log('Admin user already exists')
  process.exit(0)
}

const passwordHash = await hashPassword(password)
db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash)
console.log(`Admin user created: ${username}`)
