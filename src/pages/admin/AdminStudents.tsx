import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminStudents, ApiError, type AdminStudent } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'

const PAGE_SIZE = 25
const DEBOUNCE_MS = 300

export default function AdminStudents() {
  usePageTitle('Students')

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
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Students</h1>
            <p className="text-xs text-gray-400 mt-0.5">{total} student{total !== 1 ? 's' : ''}</p>
          </div>
          <label className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, student ID, or email"
              className="border border-gray-200 bg-gray-50 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
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

          {!isLoading && students.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700">No students found</p>
              <p className="text-sm text-gray-400 mt-1">
                {debouncedQuery ? 'Try a different search.' : 'Sync from Camu, or add students manually.'}
              </p>
            </div>
          )}

          {!isLoading && students.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left bg-gray-50/95">
                      <th className="px-5 py-2.5 font-medium text-gray-500">Student ID</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500">Name</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500">Email</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500">Program</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500">Courses</th>
                      <th className="px-5 py-2.5 font-medium text-gray-500">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{s.studentId}</td>
                        <td className="px-5 py-3 text-gray-700">{s.name}</td>
                        <td className="px-5 py-3 text-gray-500">{s.email}</td>
                        <td className="px-5 py-3 text-gray-500">{s.program || '—'}</td>
                        <td className="px-5 py-3">
                          {s.courseCount === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              No enrolments
                            </span>
                          ) : (
                            <span className="text-gray-500">{s.courseCount}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {s.source === 'camu' && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
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
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>Page {page} of {pages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                      className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
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
