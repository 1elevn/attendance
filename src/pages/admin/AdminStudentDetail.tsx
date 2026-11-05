import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminStudent, ApiError, type AdminStudentDetail as StudentDetail } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { absenceReasonLabel, formatDate, formatTime } from '../../lib/utils'
import type { AttendanceStatus } from '../../types'

const CARD = 'bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl'
const TH = 'px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted'

type StatusFilter = 'all' | Exclude<AttendanceStatus, 'pending'>

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'recorded', label: 'Present' },
  { value: 'absent_excused', label: 'Excused' },
  { value: 'absent_unexcused', label: 'Unexcused' },
]

function rateColor(rate: number | null) {
  if (rate === null) return 'text-gray-400 dark:text-slate-500'
  if (rate >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function AdminStudentDetail() {
  const { id } = useParams<{ id: string }>()

  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [courseFilter, setCourseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const student = detail?.student ?? null
  usePageTitle(student?.name ?? 'Student')

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    setCourseFilter('all')
    setStatusFilter('all')
    getAdminStudent(id)
      .then(setDetail)
      .catch((err) => {
        setDetail(null)
        if (err instanceof ApiError && err.status === 404) return // shown as "not found"
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error('Failed to load student details')
        }
      })
      .finally(() => setIsLoading(false))
  }, [id])

  const courseById = useMemo(
    () => new Map((detail?.enrolments ?? []).map((e) => [e.course.id, e.course])),
    [detail],
  )

  const enrolments = useMemo(
    () =>
      [...(detail?.enrolments ?? [])].sort(
        (a, b) =>
          Number(b.status === 'active') - Number(a.status === 'active') ||
          a.course.code.localeCompare(b.course.code),
      ),
    [detail],
  )

  const history = useMemo(
    () =>
      (detail?.history ?? []).filter(
        (h) =>
          (courseFilter === 'all' || h.courseId === courseFilter) &&
          (statusFilter === 'all' || h.status === statusFilter),
      ),
    [detail, courseFilter, statusFilter],
  )

  const activeCount = enrolments.filter((e) => e.status === 'active').length

  return (
    <div className="min-h-0 flex flex-col">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-bg-border px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <Link
            to="/admin/students"
            className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-ink-secondary transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Students
          </Link>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-ink-primary mt-0.5 truncate">
            {student?.name ?? 'Student'}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {isLoading && (
            <div className={`${CARD} p-5 space-y-3 animate-pulse`}>
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
            </div>
          )}

          {!isLoading && !detail && (
            <div className={`${CARD} flex flex-col items-center justify-center py-20 text-center`}>
              <p className="font-medium text-gray-700 dark:text-ink-secondary">Student not found</p>
              <Link to="/admin/students" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1">
                Back to Students
              </Link>
            </div>
          )}

          {!isLoading && detail && student && (
            <>
              {/* Profile */}
              <div className={`${CARD} px-5 py-4`}>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Student ID</dt>
                    <dd className="text-gray-700 dark:text-ink-secondary mt-0.5 break-all">{student.studentId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Email</dt>
                    <dd className="text-gray-700 dark:text-ink-secondary mt-0.5 break-all">{student.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Program</dt>
                    <dd className="text-gray-700 dark:text-ink-secondary mt-0.5">
                      {student.program || '—'}
                      {student.year ? ` · Year ${student.year}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-slate-500">Cohort</dt>
                    <dd className="text-gray-700 dark:text-ink-secondary mt-0.5">{student.cohortCode || '—'}</dd>
                  </div>
                </dl>
                {!student.active && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">This student is inactive.</p>
                )}
              </div>

              {/* Classes */}
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Classes</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {activeCount} active{enrolments.length > activeCount ? ` · ${enrolments.length - activeCount} dropped` : ''}
                </p>
              </div>

              {enrolments.length === 0 ? (
                <div className={`${CARD} flex flex-col items-center justify-center py-12 text-center`}>
                  <p className="font-medium text-gray-700 dark:text-ink-secondary">No classes</p>
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                    This student isn’t enrolled in any course.
                  </p>
                </div>
              ) : (
                <div className={`${CARD} overflow-x-auto`}>
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 text-left">
                        <th className={TH}>Course</th>
                        <th className={TH}>Instructors</th>
                        <th className={`${TH} text-right`}>Present</th>
                        <th className={`${TH} text-right`}>Excused</th>
                        <th className={`${TH} text-right`}>Unexcused</th>
                        <th className={`${TH} text-right`}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolments.map((e) => (
                        <tr
                          key={e.course.id}
                          className={`border-b border-gray-50 dark:border-slate-800/60 last:border-0 ${
                            e.status === 'dropped' ? 'opacity-60' : ''
                          }`}
                        >
                          <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary">
                            <span className="font-medium whitespace-nowrap">{e.course.code}</span>
                            {e.status === 'dropped' && (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-ink-muted border border-gray-200 dark:border-bg-border px-1.5 py-0.5 rounded-full">
                                Dropped
                              </span>
                            )}
                            <span className="block text-xs text-gray-400 dark:text-slate-500">{e.course.name}</span>
                          </td>
                          <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted">
                            {e.course.faculty && e.course.faculty.length > 0
                              ? e.course.faculty.map((f) => f.name).join(', ')
                              : e.course.facultyName || '—'}
                          </td>
                          <td className="px-5 py-2.5 text-right text-gray-700 dark:text-ink-secondary">{e.present}</td>
                          <td className="px-5 py-2.5 text-right text-gray-700 dark:text-ink-secondary">{e.excused}</td>
                          <td className="px-5 py-2.5 text-right text-gray-700 dark:text-ink-secondary">{e.unexcused}</td>
                          <td className={`px-5 py-2.5 text-right font-semibold ${rateColor(e.rate)}`}>
                            {e.rate === null ? '—' : `${e.rate}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* History */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Attendance history</h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {history.length} of {detail.history.length} session{detail.history.length !== 1 ? 's' : ''} · closed sessions only
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    aria-label="Filter by course"
                    className="border border-gray-200 dark:border-bg-border bg-gray-50 dark:bg-bg-elevated/40 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All courses</option>
                    {enrolments.map((e) => (
                      <option key={e.course.id} value={e.course.id}>
                        {e.course.code}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    {STATUS_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors border ${
                          statusFilter === f.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'text-gray-600 dark:text-ink-secondary bg-white dark:bg-bg-surface border-gray-200 dark:border-bg-border hover:bg-gray-50 dark:hover:bg-bg-elevated/60'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {history.length === 0 ? (
                <div className={`${CARD} flex flex-col items-center justify-center py-12 text-center`}>
                  <p className="font-medium text-gray-700 dark:text-ink-secondary">
                    {detail.history.length === 0 ? 'No attendance history yet' : 'No sessions match these filters'}
                  </p>
                  {detail.history.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                      History appears here once a session the student was rostered for has closed.
                    </p>
                  )}
                </div>
              ) : (
                <div className={`${CARD} overflow-x-auto`}>
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 text-left">
                        <th className={TH}>Date</th>
                        <th className={TH}>Course</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Details</th>
                        <th className={TH}>Checked in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => {
                        const course = courseById.get(h.courseId)
                        return (
                          <tr key={h.id} className="border-b border-gray-50 dark:border-slate-800/60 last:border-0 align-top">
                            <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary whitespace-nowrap">
                              {formatDate(h.date)}
                              <span className="block text-xs text-gray-400 dark:text-slate-500">{h.startTime}</span>
                            </td>
                            <td className="px-5 py-2.5 text-gray-700 dark:text-ink-secondary whitespace-nowrap">
                              {course?.code ?? '—'}
                            </td>
                            <td className="px-5 py-2.5 whitespace-nowrap">
                              <StatusBadge status={h.status} />
                              {h.overridden && (
                                <Badge variant="warning" size="sm" className="ml-2">
                                  Faculty override
                                </Badge>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted min-w-[12rem]">
                              {h.absenceReason && <span>{absenceReasonLabel(h.absenceReason)}</span>}
                              {h.note && (
                                <span className="block text-xs italic text-gray-500 dark:text-ink-muted">“{h.note}”</span>
                              )}
                              {!h.absenceReason && !h.note && '—'}
                            </td>
                            <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted whitespace-nowrap">
                              {h.submittedAt ? formatTime(h.submittedAt) : '—'}
                              {h.deviceType === 'laptop' && (
                                <span className="block text-xs text-amber-600 dark:text-amber-400">Laptop</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
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
