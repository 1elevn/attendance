import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, Search, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import {
  getAdminFaculty,
  sendFacultyInvite,
  sendBulkFacultyInvites,
  ApiError,
  type AdminFaculty as AdminFacultyRow,
} from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function StatusBadge({ faculty }: { faculty: AdminFacultyRow }) {
  if (faculty.activated) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full">
        Activated
      </span>
    )
  }
  if (faculty.invitedAt) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.5 rounded-full">
        Invited
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap bg-gray-100 dark:bg-bg-elevated text-gray-500 dark:text-ink-muted border border-gray-200 dark:border-bg-border px-1.5 py-0.5 rounded-full">
      Not invited
    </span>
  )
}

export default function AdminFaculty() {
  usePageTitle('Faculty')
  const navigate = useNavigate()

  const [faculty, setFaculty] = useState<AdminFacultyRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [isBulkInviting, setIsBulkInviting] = useState(false)
  const [query, setQuery] = useState('')

  function load() {
    setIsLoading(true)
    getAdminFaculty()
      .then(setFaculty)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error('Failed to load faculty')
        }
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  // Manually-seeded accounts already have a password and don't need invite
  // management — this screen is specifically for the Camu-provisioned ones.
  const camuFaculty = useMemo(() => faculty.filter((f) => f.source === 'camu'), [faculty])
  const sortedFaculty = useMemo(() => {
    return [...camuFaculty].sort((a, b) => {
      if (a.activated !== b.activated) return a.activated ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [camuFaculty])
  const pendingCount = camuFaculty.filter((f) => !f.activated).length

  // Camu names sometimes carry doubled spaces ("Aaron Amarh  Ashitey"), so both
  // sides are whitespace-collapsed before matching.
  const trimmedQuery = normalizeForSearch(query)
  const visibleFaculty = useMemo(() => {
    if (!trimmedQuery) return sortedFaculty
    return sortedFaculty.filter(
      (f) => normalizeForSearch(f.name).includes(trimmedQuery) || normalizeForSearch(f.email).includes(trimmedQuery),
    )
  }, [sortedFaculty, trimmedQuery])

  async function invite(id: string) {
    setInvitingId(id)
    try {
      const { invitedAt } = await sendFacultyInvite(id)
      setFaculty((prev) => prev.map((f) => (f.id === id ? { ...f, invitedAt } : f)))
      toast.success('Invite sent')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send invite')
    } finally {
      setInvitingId(null)
    }
  }

  async function inviteAllPending() {
    setIsBulkInviting(true)
    try {
      const result = await sendBulkFacultyInvites()
      if (result.sent > 0) {
        toast.success(`Sent ${result.sent} invite${result.sent !== 1 ? 's' : ''}`)
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} invite${result.failed !== 1 ? 's' : ''} failed to send`)
      }
      if (result.sent === 0 && result.failed === 0) {
        toast('No pending faculty to invite')
      }
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send invites')
    } finally {
      setIsBulkInviting(false)
    }
  }

  return (
    <div className="min-h-0 flex flex-col">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-bg-border px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Faculty</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {trimmedQuery ? `${visibleFaculty.length} of ${camuFaculty.length} shown` : `${camuFaculty.length} synced from Camu`}
              {pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium"> · {pendingCount} pending</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <label className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                className="border border-gray-200 dark:border-bg-border bg-gray-50 dark:bg-bg-elevated/40 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-ink-secondary w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <button
              onClick={inviteAllPending}
              disabled={pendingCount === 0 || isBulkInviting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {isBulkInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Invite all pending
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {isLoading && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
            </div>
          )}

          {!isLoading && sortedFaculty.length === 0 && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700 dark:text-ink-secondary">No Camu-synced faculty yet</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Run a Camu sync to provision faculty accounts.</p>
            </div>
          )}

          {!isLoading && sortedFaculty.length > 0 && visibleFaculty.length === 0 && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700 dark:text-ink-secondary">No faculty match “{query.trim()}”</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Try a different name or email.</p>
            </div>
          )}

          {!isLoading && visibleFaculty.length > 0 && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 text-left">
                    <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Name</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Email</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Status</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Last invited</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visibleFaculty.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => navigate(`/admin/faculty/${f.id}`)}
                      className="border-b border-gray-50 dark:border-slate-800/60 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-elevated/60 transition-colors"
                    >
                      <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary font-medium whitespace-nowrap">
                        <Link
                          to={`/admin/faculty/${f.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none focus-visible:underline"
                        >
                          {f.name}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted">{f.email}</td>
                      <td className="px-5 py-2.5">
                        <StatusBadge faculty={f} />
                      </td>
                      <td className="px-5 py-2.5 text-gray-400 dark:text-slate-500 whitespace-nowrap">{formatDateTime(f.invitedAt)}</td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        {!f.activated && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              invite(f.id)
                            }}
                            disabled={invitingId === f.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-bg-elevated text-gray-700 dark:text-ink-secondary hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                          >
                            {invitingId === f.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Mail className="w-3 h-3" />
                            )}
                            {f.invitedAt ? 'Resend' : 'Send invite'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
