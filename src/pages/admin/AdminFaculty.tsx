import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAdminFaculty,
  sendFacultyInvite,
  sendBulkFacultyInvites,
  ApiError,
  type AdminFaculty as AdminFacultyRow,
} from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function StatusBadge({ faculty }: { faculty: AdminFacultyRow }) {
  if (faculty.activated) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">
        Activated
      </span>
    )
  }
  if (faculty.invitedAt) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
        Invited
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full">
      Not invited
    </span>
  )
}

export default function AdminFaculty() {
  usePageTitle('Faculty')

  const [faculty, setFaculty] = useState<AdminFacultyRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [isBulkInviting, setIsBulkInviting] = useState(false)

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
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Faculty</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {camuFaculty.length} synced from Camu
              {pendingCount > 0 && <span className="text-amber-600 font-medium"> · {pendingCount} pending</span>}
            </p>
          </div>
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

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {isLoading && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          )}

          {!isLoading && sortedFaculty.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700">No Camu-synced faculty yet</p>
              <p className="text-sm text-gray-400 mt-1">Run a Camu sync to provision faculty accounts.</p>
            </div>
          )}

          {!isLoading && sortedFaculty.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-2.5 font-medium text-gray-500">Name</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500">Email</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500">Status</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500">Last invited</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sortedFaculty.map((f) => (
                    <tr key={f.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-2.5 text-gray-700 font-medium whitespace-nowrap">{f.name}</td>
                      <td className="px-5 py-2.5 text-gray-500">{f.email}</td>
                      <td className="px-5 py-2.5">
                        <StatusBadge faculty={f} />
                      </td>
                      <td className="px-5 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(f.invitedAt)}</td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        {!f.activated && (
                          <button
                            onClick={() => invite(f.id)}
                            disabled={invitingId === f.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
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
