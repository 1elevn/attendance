import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAdminCourses,
  getAdminFaculty,
  sendFacultyInvite,
  ApiError,
  type AdminFaculty as AdminFacultyRow,
} from '../../lib/api'
import type { Course } from '../../types'
import { usePageTitle } from '../../hooks/usePageTitle'
import { StatusBadge, formatDateTime } from './AdminFaculty'

export default function AdminFacultyDetail() {
  const { id } = useParams<{ id: string }>()

  const [faculty, setFaculty] = useState<AdminFacultyRow | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviting, setIsInviting] = useState(false)

  usePageTitle(faculty?.name ?? 'Faculty')

  useEffect(() => {
    setIsLoading(true)
    Promise.all([getAdminFaculty(), getAdminCourses()])
      .then(([allFaculty, allCourses]) => {
        setFaculty(allFaculty.find((f) => f.id === id) ?? null)
        setCourses(allCourses)
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error('Failed to load faculty details')
        }
      })
      .finally(() => setIsLoading(false))
  }, [id])

  // A course is shared by every instructor in facultyIds, so co-taught courses
  // show up under each of them.
  const managedCourses = useMemo(
    () => courses.filter((c) => c.facultyIds?.includes(id ?? '')).sort((a, b) => a.code.localeCompare(b.code)),
    [courses, id],
  )
  const totalStudents = managedCourses.reduce((sum, c) => sum + c.enrolledCount, 0)

  async function invite() {
    if (!faculty) return
    setIsInviting(true)
    try {
      const { invitedAt } = await sendFacultyInvite(faculty.id)
      setFaculty({ ...faculty, invitedAt })
      toast.success('Invite sent')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send invite')
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <div className="min-h-0 flex flex-col">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-bg-border px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <Link
            to="/admin/faculty"
            className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-ink-secondary transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Faculty
          </Link>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-ink-primary mt-0.5">{faculty?.name ?? 'Faculty'}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          {isLoading && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
            </div>
          )}

          {!isLoading && !faculty && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700 dark:text-ink-secondary">Faculty member not found</p>
              <Link to="/admin/faculty" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1">
                Back to Faculty
              </Link>
            </div>
          )}

          {!isLoading && faculty && (
            <>
              <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Email</dt>
                    <dd className="text-gray-700 dark:text-ink-secondary mt-0.5 break-all">{faculty.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Department</dt>
                    <dd className="text-gray-700 dark:text-ink-secondary mt-0.5">{faculty.department || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Status</dt>
                    <dd className="mt-0.5">
                      <StatusBadge faculty={faculty} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Last invited</dt>
                    <dd className="text-gray-700 dark:text-ink-secondary mt-0.5 whitespace-nowrap">{formatDateTime(faculty.invitedAt)}</dd>
                  </div>
                </dl>
                {!faculty.activated && (
                  <button
                    onClick={invite}
                    disabled={isInviting}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-bg-elevated text-gray-700 dark:text-ink-secondary hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isInviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    {faculty.invitedAt ? 'Resend' : 'Send invite'}
                  </button>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Courses</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {managedCourses.length} course{managedCourses.length !== 1 ? 's' : ''} · {totalStudents} enrolment
                  {totalStudents !== 1 ? 's' : ''}
                </p>
              </div>

              {managedCourses.length === 0 ? (
                <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
                  <p className="font-medium text-gray-700 dark:text-ink-secondary">No courses yet</p>
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                    This faculty member isn’t assigned to any course. Courses appear here once a Camu sync links them.
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 text-left">
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Code</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Course</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Cohort</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Schedule</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Room</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted text-right">Students</th>
                        <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Instructors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managedCourses.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50 dark:border-slate-800/60 last:border-0">
                          <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary font-medium whitespace-nowrap">{c.code}</td>
                          <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary min-w-[12rem]">{c.name}</td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted whitespace-nowrap">
                            {c.cohort}
                            <span className="block text-xs text-gray-400 dark:text-slate-500">{c.cohortCode}</span>
                          </td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted min-w-[14rem]">{c.schedule || '—'}</td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted whitespace-nowrap">{c.room || '—'}</td>
                          <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary text-right">{c.enrolledCount}</td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted min-w-[10rem]">
                            {c.faculty && c.faculty.length > 0
                              ? c.faculty.map((f) => f.name).join(', ')
                              : c.facultyName || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
