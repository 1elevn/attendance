import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminStudents, ApiError, type AdminStudent } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'

const PAGE_SIZE = 25
const DEBOUNCE_MS = 300

export default function AdminStudents() {
  usePageTitle('Students')
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => { setPage(1) }, [debouncedQuery])

  useEffect(() => {
    setIsLoading(true)
    getAdminStudents({ q: debouncedQuery || undefined, page, limit: PAGE_SIZE })
      .then((res) => {
        setStudents(res.data)
        setTotal(res.total)
        setPages(res.pages)
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error('Failed to load students')
        }
      })
      .finally(() => setIsLoading(false))
  }, [debouncedQuery, page])

  return (
    <div className="min-h-0 flex flex-col">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-bg-border px-6 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Students</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{total} student{total !== 1 ? 's' : ''}</p>
          </div>
          <label className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, student ID, or email"
              className="border border-gray-200 dark:border-bg-border bg-gray-50 dark:bg-bg-elevated/40 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-ink-secondary w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {isLoading && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
            </div>
          )}

          {!isLoading && students.length === 0 && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700 dark:text-ink-secondary">No students found</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                {debouncedQuery ? 'Try a different search.' : 'Sync from Camu, or add students manually.'}
              </p>
            </div>
          )}

          {!isLoading && students.length > 0 && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 text-left bg-gray-50/95 dark:bg-bg-base/95">
                      <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Student ID</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Name</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Email</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Program</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Courses</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
                    {students.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/admin/students/${s.id}`)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-elevated/60 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-gray-800 dark:text-ink-primary whitespace-nowrap">{s.studentId}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-ink-secondary">
                          <Link
                            to={`/admin/students/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none focus-visible:underline"
                          >
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-ink-muted">{s.email}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-ink-muted">{s.program || '—'}</td>
                        <td className="px-5 py-3">
                          {s.courseCount === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.5 rounded-full">
                              No enrolments
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-ink-muted">{s.courseCount}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {s.source === 'camu' && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-1.5 py-0.5 rounded-full">
                              Camu
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-ink-muted">
                  <span>Page {page} of {pages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-2 py-1 rounded border border-gray-200 dark:border-bg-border disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                      className="px-2 py-1 rounded border border-gray-200 dark:border-bg-border disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
