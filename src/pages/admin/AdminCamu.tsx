import { useEffect, useState } from 'react'
import { RefreshCw, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCamuSyncHistory, ApiError, type CamuSyncResult } from '../../lib/api'
import { useCamuSyncStatus } from '../../hooks/useCamuSyncStatus'
import { usePageTitle } from '../../hooks/usePageTitle'

const STATUS_STYLES: Record<CamuSyncResult['status'], string> = {
  running: 'bg-blue-50 text-blue-600 border-blue-200',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  partial: 'bg-amber-50 text-amber-600 border-amber-200',
  error: 'bg-red-50 text-red-600 border-red-200',
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
    <div className="bg-white px-4 py-3">
      <p className="text-lg font-semibold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
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

  const { status, isLoading, isSyncing, start } = useCamuSyncStatus({
    onSettled: () => loadHistory(1),
  })

  useEffect(() => { loadHistory(1) }, [])

  async function handleSync() {
    try {
      await start()
      toast.success('Camu sync started')
    } catch {
      // start() already toasted the specific error
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
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Camu Sync</h1>
            <p className="text-xs text-gray-400 mt-0.5">Status, history, and errors for the Camu integration</p>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

          {/* Last run card */}
          {isLoading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-20 bg-gray-100 rounded" />
            </div>
          ) : !status ? (
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-16 text-center">
              <p className="font-medium text-gray-700">No sync has run yet</p>
              <p className="text-sm text-gray-400 mt-1">Click "Sync now" to pull students and enrollments from Camu.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={status.status} />
                  <span className="text-xs text-gray-400 capitalize">{status.trigger}</span>
                  {status.triggeredByName && (
                    <span className="text-xs text-gray-400">by {status.triggeredByName}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Started {formatDateTime(status.startedAt)} · Duration {formatDuration(status.durationMs)}
                  {status.academicYear && ` · ${status.academicYear} ${status.semester ?? ''}`}
                </p>
              </div>

              {/* Counter grid — raw rows fetched per phase, plus outcome counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
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
                <div className="px-5 py-3 border-t border-gray-100 bg-amber-50/40">
                  <p className="text-xs font-semibold text-amber-700 mb-1">
                    {status.warnings.length} warning{status.warnings.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                    {status.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Errors panel */}
              {status.errors.length > 0 && (
                <div className="border-t border-gray-100">
                  <div className="px-5 py-2.5 flex items-center justify-between bg-red-50/40">
                    <p className="text-xs font-semibold text-red-700">
                      {status.errorCount} error{status.errorCount !== 1 ? 's' : ''}
                      {status.errorCount > status.errors.length && ` — showing ${status.errors.length} of ${status.errorCount}`}
                    </p>
                    <button
                      onClick={copyErrors}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
                    >
                      <Copy className="w-3 h-3" />
                      Copy all
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto px-5 py-3 bg-red-50/20">
                    <ul className="text-xs font-mono text-red-700 space-y-1">
                      {status.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">History</h2>
            </div>
            {isHistoryLoading ? (
              <div className="p-5 space-y-2 animate-pulse">
                <div className="h-8 bg-gray-100 rounded" />
                <div className="h-8 bg-gray-100 rounded" />
              </div>
            ) : history.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No sync runs yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left bg-gray-50/95">
                        <th className="px-5 py-2.5 font-medium text-gray-500">Started</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500">Status</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500">Trigger</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500">Duration</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td className="px-5 py-2.5 text-gray-700 whitespace-nowrap">{formatDateTime(h.startedAt)}</td>
                          <td className="px-5 py-2.5"><StatusBadge status={h.status} /></td>
                          <td className="px-5 py-2.5 text-gray-500 capitalize">{h.trigger}</td>
                          <td className="px-5 py-2.5 text-gray-500">{formatDuration(h.durationMs)}</td>
                          <td className="px-5 py-2.5 text-gray-500">{h.errorCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {historyPages > 1 && (
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Page {historyPage} of {historyPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadHistory(historyPage - 1)}
                        disabled={historyPage <= 1}
                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => loadHistory(historyPage + 1)}
                        disabled={historyPage >= historyPages}
                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
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
