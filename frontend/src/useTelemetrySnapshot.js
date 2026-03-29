import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export function useTelemetrySnapshot(enabled) {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError('')
    try {
      const data = await api.snapshot()
      setSnapshot(data)
    } catch (err) {
      setError(err.message || 'snapshot_error')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    load()
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [enabled, load])

  return { snapshot, loading, error, reload: load }
}
