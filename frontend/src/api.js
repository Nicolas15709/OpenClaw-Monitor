const API_BASE = import.meta.env.VITE_MONITOR_API_BASE || 'http://127.0.0.1:4180'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.error || `request_failed_${response.status}`
    throw new Error(message)
  }

  return data
}

export const api = {
  base: API_BASE,
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  snapshot: () => request('/api/telemetry/snapshot'),
}
