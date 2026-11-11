import { useEffect, useState } from 'react'
import { RefreshCw, Copy, Square, CheckCircle2, Loader2, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCamuSyncHistory, ApiError, type CamuSyncResult, type CamuSyncPhase } from '../../lib/api'
import { useCamuSyncStatus } from '../../hooks/useCamuSyncStatus'
import { usePageTitle } from '../../hooks/usePageTitle'

const STATUS_STYLES: Record<CamuSyncResult['status'], string> = {
  running: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  partial: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  error: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30',
  cancelled: 'bg-gray-100 dark:bg-bg-elevated text-gray-500 dark:text-ink-muted border-gray-200 dark:border-bg-border',
}

const PHASE_STEPS: { key: Exclude<CamuSyncPhase, 'done'>; label: string }[] = [
  { key: 'resolving_term', label: 'Resolving term' },
  { key: 'syncing_enrolments', label: 'Syncing enrolments & courses' },
  { key: 'syncing_roster', label: 'Syncing student roster' },
  { key: 'syncing_staff', label: 'Resolving staff & schedules' },
]

/**
 * A checklist of the sync's fixed phases (there's no knowable total row/page
 * count ahead of time -- see camuSync.ts -- so "what's left" is expressed as
 * remaining phases, not a percentage bar), with live counters for the two
 * that actually take a while.
 */
function PhaseChecklist({ status }: { status: CamuSyncResult }) {
  const isDone = status.currentPhase === 'done'
  const currentIndex = isDone
    ? PHASE_STEPS.length
    : PHASE_STEPS.findIndex((p) => p.key === status.currentPhase)

  return (
    <ul className="px-5 py-3 space-y-1.5">
      {PHASE_STEPS.map((phase, i) => {
        const isCurrent = !isDone && i === currentIndex && status.status === 'running'
        const isCompleted = isDone || i < currentIndex
        return (
          <li key={phase.key} className="flex items-center gap-2 text-xs">
            {isCurrent ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
            )}
            <span className={isCompleted ? 'text-gray-500 dark:text-ink-muted' : isCurrent ? 'text-gray-800 dark:text-ink-primary font-medium' : 'text-gray-400 dark:text-slate-500'}>
              {phase.label}
            </span>
            {phase.key === 'syncing_enrolments' && (isCurrent || isCompleted) && (
              <span className="text-gray-400 dark:text-slate-500">
                — {status.coursesCreated} course{status.coursesCreated !== 1 ? 's' : ''}, {status.studentsCreated} student{status.studentsCreated !== 1 ? 's' : ''} created so far
              </span>
            )}
            {phase.key === 'syncing_roster' && (isCurrent || isCompleted) && (
              <span className="text-gray-400 dark:text-slate-500">
                — {status.rosterPagesFetched} page{status.rosterPagesFetched !== 1 ? 's' : ''}, {status.rosterRowsFetched} row{status.rosterRowsFetched !== 1 ? 's' : ''} fetched so far
              </span>
            )}
            {isCurrent && status.cancelRequested && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">— stopping…</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function StatusBadge({ status }: { status: CamuSyncResult['status'] }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide border px-1.5 py-0.5 rounded-full ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-bg-surface px-4 py-3">
      <p className="text-lg font-semibold text-gray-800 dark:text-ink-primary">{value}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
    </div>
  )
}

export default function AdminCamu() {
  usePageTitle('Camu Sync')

  const [history, setHistory] = useState<CamuSyncResult[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPages, setHistoryPages] = useState(1)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)

  function loadHistory(page: number) {
    setIsHistoryLoading(true)
    getCamuSyncHistory({ page, limit: 20 })
      .then((res) => {
        setHistory(res.data)
        setHistoryPage(res.page)
        setHistoryPages(res.pages)
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error('Failed to load sync history')
        }
      })
      .finally(() => setIsHistoryLoading(false))
  }

  const { status, isLoading, isSyncing, start, stop } = useCamuSyncStatus({
    onSettled: () => loadHistory(1),
  })
  const [isStopping, setIsStopping] = useState(false)

  useEffect(() => { loadHistory(1) }, [])

  async function handleSync() {
    try {
      await start()
      toast.success('Camu sync started')
    } catch {
      // start() already toasted the specific error
    }
  }

  async function handleStop() {
    setIsStopping(true)
    try {
      await stop()
      toast.success('Stop requested — the sync will wind down shortly')
    } catch {
      // stop() already toasted the specific error
    } finally {
      setIsStopping(false)
    }
  }

  function copyErrors() {
    if (!status?.errors.length) return
    navigator.clipboard.writeText(status.errors.join('\n')).then(
      () => toast.success('Errors copied to clipboard'),
      () => toast.error('Could not copy to clipboard'),
    )
  }

  return (
    <div className="min-h-0 flex flex-col">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-bg-border px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Camu Sync</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Status, history, and errors for the Camu integration</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isSyncing && (
              <button
                onClick={handleStop}
                disabled={isStopping || status?.cancelRequested}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-bg-surface text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                {status?.cancelRequested ? 'Stopping…' : 'Stop sync'}
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg border border-gray-200 dark:border-bg-border bg-white dark:bg-bg-surface text-gray-600 dark:text-ink-secondary hover:bg-gray-50 dark:hover:bg-bg-elevated/60 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

          {/* Last run card */}
          {isLoading ? (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-20 bg-gray-100 dark:bg-bg-elevated rounded" />
            </div>
          ) : !status ? (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
              <p className="font-medium text-gray-700 dark:text-ink-secondary">No sync has run yet</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Click "Sync now" to pull students and enrollments from Camu.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={status.status} />
                  <span className="text-xs text-gray-400 dark:text-slate-500 capitalize">{status.trigger}</span>
                  {status.triggeredByName && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">by {status.triggeredByName}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Started {formatDateTime(status.startedAt)} · Duration {formatDuration(status.durationMs)}
                  {status.academicYear && ` · ${status.academicYear} ${status.semester ?? ''}`}
                </p>
              </div>

              {/* Phase checklist — what's synced, what's syncing now, what's left */}
              <div className="border-b border-gray-100 dark:border-slate-800">
                <PhaseChecklist status={status} />
              </div>

              {/* Counter grid — raw rows fetched per phase, plus outcome counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-bg-elevated">
                <Stat label="Roster pages fetched" value={status.rosterPagesFetched} />
                <Stat label="Roster rows fetched" value={status.rosterRowsFetched} />
                <Stat label="Enrolment rows fetched" value={status.enrolmentRowsFetched} />
                <Stat label="Students created" value={status.studentsCreated} />
                <Stat label="Students updated" value={status.studentsUpdated} />
                <Stat label="Students deactivated" value={status.studentsDeactivated} />
                <Stat label="Courses created" value={status.coursesCreated} />
                <Stat label="Faculty accounts created" value={status.facultyAccountsCreated} />
                <Stat label="Enrolments linked" value={status.enrollmentsLinked} />
                <Stat label="Enrolments unlinked" value={status.enrollmentsUnlinked} />
              </div>

              {/* Warnings */}
              {status.warnings.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-500/5">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    {status.warnings.length} warning{status.warnings.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                    {status.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Errors panel */}
              {status.errors.length > 0 && (
                <div className="border-t border-gray-100 dark:border-slate-800">
                  <div className="px-5 py-2.5 flex items-center justify-between bg-red-50/40 dark:bg-red-500/5">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                      {status.errorCount} error{status.errorCount !== 1 ? 's' : ''}
                      {status.errorCount > status.errors.length && ` — showing ${status.errors.length} of ${status.errorCount}`}
                    </p>
                    <button
                      onClick={copyErrors}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      <Copy className="w-3 h-3" />
                      Copy all
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto px-5 py-3 bg-red-50/20 dark:bg-red-500/5">
                    <ul className="text-xs font-mono text-red-700 dark:text-red-400 space-y-1">
                      {status.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History table */}
          <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-ink-secondary">History</h2>
            </div>
            {isHistoryLoading ? (
              <div className="p-5 space-y-2 animate-pulse">
                <div className="h-8 bg-gray-100 dark:bg-bg-elevated rounded" />
                <div className="h-8 bg-gray-100 dark:bg-bg-elevated rounded" />
              </div>
            ) : history.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-slate-500">No sync runs yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 text-left bg-gray-50/95 dark:bg-bg-base/95">
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Started</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Status</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Trigger</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Duration</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary whitespace-nowrap">{formatDateTime(h.startedAt)}</td>
                          <td className="px-5 py-2.5"><StatusBadge status={h.status} /></td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted capitalize">{h.trigger}</td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted">{formatDuration(h.durationMs)}</td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted">{h.errorCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {historyPages > 1 && (
                  <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-ink-muted">
                    <span>Page {historyPage} of {historyPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadHistory(historyPage - 1)}
                        disabled={historyPage <= 1}
                        className="px-2 py-1 rounded border border-gray-200 dark:border-bg-border disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => loadHistory(historyPage + 1)}
                        disabled={historyPage >= historyPages}
                        className="px-2 py-1 rounded border border-gray-200 dark:border-bg-border disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
