import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ApiError, getCamuSyncStatus, triggerCamuSync, stopCamuSync, type CamuSyncResult } from '../lib/api'

const POLL_INTERVAL_MS = 3_000
const MAX_POLL_DURATION_MS = 10 * 60_000

/**
 * Tracks the current Camu sync run and polls while one is in progress.
 * Uses a recursive setTimeout rather than setInterval so a slow status check
 * can't pile up overlapping requests.
 */
export function useCamuSyncStatus(opts?: { onSettled?: (log: CamuSyncResult) => void }) {
  const [status, setStatus] = useState<CamuSyncResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const cancelledRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)
  const pollStartRef = useRef<number | null>(null)
  const prevRef = useRef<{ id: string; status: string } | null>(null)
  const onSettledRef = useRef(opts?.onSettled)
  onSettledRef.current = opts?.onSettled

  const stopPolling = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pollStartRef.current = null
  }, [])

  const applyStatus = useCallback((next: CamuSyncResult | null) => {
    if (cancelledRef.current) return
    setStatus(next)
    if (next) {
      const prev = prevRef.current
      if (prev && prev.id === next.id && prev.status === 'running' && next.status !== 'running') {
        onSettledRef.current?.(next)
      }
      prevRef.current = { id: next.id, status: next.status }
    }
  }, [])

  const poll = useCallback(() => {
    getCamuSyncStatus()
      .then((next) => {
        applyStatus(next)
        if (cancelledRef.current) return

        if (next?.status === 'running') {
          const elapsed = Date.now() - (pollStartRef.current ?? Date.now())
          if (elapsed > MAX_POLL_DURATION_MS) {
            stopPolling()
            toast.error('Camu sync is taking unusually long — check back later.')
            return
          }
          timeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
        } else {
          stopPolling()
        }
      })
      .catch((err) => {
        if (cancelledRef.current) return
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error(err instanceof ApiError ? err.message : 'Failed to check Camu sync status')
        }
        stopPolling()
      })
  }, [applyStatus, stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    pollStartRef.current = Date.now()
    poll()
  }, [poll, stopPolling])

  const refresh = useCallback(() => {
    setIsLoading(true)
    getCamuSyncStatus()
      .then((next) => {
        applyStatus(next)
        if (next?.status === 'running') startPolling()
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error(err instanceof ApiError ? err.message : 'Failed to load Camu sync status')
        }
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false)
      })
  }, [applyStatus, startPolling])

  useEffect(() => {
    cancelledRef.current = false
    refresh()
    return () => {
      cancelledRef.current = true
      stopPolling()
    }
  }, [refresh, stopPolling])

  /** Triggers a new sync; on a 409 (already running) it seeds from the in-flight log and polls that instead. */
  const start = useCallback(async () => {
    try {
      const result = await triggerCamuSync()
      applyStatus(result)
      startPolling()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const log = (err.body as { log?: CamuSyncResult | null }).log
        if (log) {
          applyStatus(log)
          startPolling()
          return
        }
      }
      if (!(err instanceof ApiError && err.status === 401)) {
        toast.error(err instanceof ApiError ? err.message : 'Camu sync failed to start')
      }
      throw err
    }
  }, [applyStatus, startPolling])

  /** Requests cooperative cancellation — the run stops itself at its next
   *  checkpoint, so `status` keeps polling as 'running' (with cancelRequested
   *  true) for a bit before landing on 'cancelled'. */
  const stop = useCallback(async () => {
    try {
      const result = await stopCamuSync()
      applyStatus(result)
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to stop Camu sync')
      }
      throw err
    }
  }, [applyStatus])

  return {
    status,
    isLoading,
    isSyncing: status?.status === 'running',
    refresh,
    start,
    stop,
  }
}
