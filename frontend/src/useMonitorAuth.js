import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export function useMonitorAuth() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setChecking(true)
    setError('')
    try {
      const me = await api.me()
      setUser({ username: me.username })
    } catch {
      setUser(null)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (username, password) => {
    setError('')
    const result = await api.login(username, password)
    setUser({ username: result.username })
    return result
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  return { user, checking, error, setError, login, logout, refresh }
}
