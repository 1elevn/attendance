import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  addCourseFaculty,
  removeCourseFaculty,
  getAdminCourse,
  getAdminFaculty,
  ApiError,
  type AdminCourseDetail as CourseDetail,
  type AdminFaculty,
} from '../../lib/api'
import { Modal } from '../../components/ui/Modal'
import { usePageTitle } from '../../hooks/usePageTitle'
import { formatDateTime } from './AdminFaculty'

const card = 'bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl'
const label = 'text-xs font-medium text-gray-400 dark:text-slate-500'
const value = 'text-gray-700 dark:text-ink-secondary mt-0.5'
const pill =
  'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border'

export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [allFaculty, setAllFaculty] = useState<AdminFaculty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  usePageTitle(course?.code ?? 'Course')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [detail, faculty] = await Promise.all([getAdminCourse(id), getAdminFaculty()])
      setCourse(detail)
      setAllFaculty(faculty)
    } catch (err) {
      setCourse(null)
      if (!(err instanceof ApiError && (err.status === 401 || err.status === 404))) {
        toast.error('Failed to load course details')
      }
    }
  }, [id])

  useEffect(() => {
    setIsLoading(true)
    load().finally(() => setIsLoading(false))
  }, [load])

  const candidates = useMemo(() => {
    const linked = new Set(course?.facultyLinks.map((l) => l.id))
    const q = query.trim().toLowerCase()
    return allFaculty.filter(
      (f) => !linked.has(f.id) && (!q || f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)),
    )
  }, [allFaculty, course, query])

  async function mutate(userId: string, action: 'add' | 'remove') {
    if (!id) return
    setBusyId(userId)
    try {
      if (action === 'add') await addCourseFaculty(id, userId)
      else await removeCourseFaculty(id, userId)
      await load()
      if (action === 'add') {
        setPickerOpen(false)
        setQuery('')
      }
      toast.success(action === 'add' ? 'Faculty linked' : 'Link removed')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update faculty links')
    } finally {
      setBusyId(null)
    }
  }

  const isCamu = course?.source === 'camu'

  return (
    <div className="min-h-0 flex flex-col">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-bg-border px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto">
          <Link
            to="/admin/courses"
            className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-ink-secondary transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Courses
          </Link>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-ink-primary mt-0.5">
            {course ? `${course.code} · ${course.name}` : 'Course'}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {isLoading && (
            <div className={`${card} p-5 space-y-3 animate-pulse`}>
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
            </div>
          )}

          {!isLoading && !course && (
            <div className={`${card} flex flex-col items-center justify-center py-20 text-center`}>
              <p className="font-medium text-gray-700 dark:text-ink-secondary">Course not found</p>
              <Link to="/admin/courses" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1">
                Back to Courses
              </Link>
            </div>
          )}

          {!isLoading && course && (
            <>
              <dl className={`${card} px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-sm`}>
                <div><dt className={label}>Department</dt><dd className={value}>{course.department}</dd></div>
                <div><dt className={label}>Cohort</dt><dd className={value}>{course.cohort}<span className="block text-xs text-gray-400 dark:text-slate-500">{course.cohortCode}</span></dd></div>
                <div><dt className={label}>Schedule</dt><dd className={value}>{course.schedule || '—'}</dd></div>
                <div><dt className={label}>Room</dt><dd className={value}>{course.room || '—'}</dd></div>
                <div><dt className={label}>Credits</dt><dd className={value}>{course.credits}</dd></div>
                <div><dt className={label}>Students</dt><dd className={value}>{course.students.length}</dd></div>
                <div><dt className={label}>Closed sessions</dt><dd className={value}>{course.sessionCount}</dd></div>
                <div><dt className={label}>Last session</dt><dd className={value}>{course.lastSessionDate ?? '—'}</dd></div>
              </dl>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Faculty</h2>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Everyone linked can take attendance for this course.
                    </p>
                  </div>
                  {isCamu && (
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add faculty
                    </button>
                  )}
                </div>

                {course.facultyLinks.length === 0 ? (
                  <div className={`${card} px-5 py-6 text-sm text-gray-500 dark:text-ink-muted`}>
                    <p className="font-medium text-gray-700 dark:text-ink-secondary">No faculty linked</p>
                    {isCamu && (
                      <p className="mt-1">Use “Add faculty” to link someone manually; it persists across syncs.</p>
                    )}
                  </div>
                ) : (
                  <ul className={`${card} divide-y divide-gray-100 dark:divide-slate-800`}>
                    {course.facultyLinks.map((l) => (
                      <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/admin/faculty/${l.id}`}
                            className="text-sm font-medium text-gray-800 dark:text-ink-primary hover:underline"
                          >
                            {l.name}
                          </Link>
                          <p className="text-xs text-gray-400 dark:text-slate-500 break-all">
                            {l.email}{!l.activated && ' · not activated'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {l.viaCamu && (
                            <span className={`${pill} bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30`}>
                              Camu
                            </span>
                          )}
                          {l.manual && (
                            <span className={`${pill} bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30`}>
                              Manual
                            </span>
                          )}
                          {l.manual && (
                            <button
                              onClick={() => mutate(l.id, 'remove')}
                              disabled={busyId === l.id}
                              aria-label={`Remove ${l.name}`}
                              title={l.viaCamu ? 'Camu now links this person too; the manual link is redundant' : 'Remove manual link'}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-bg-elevated disabled:opacity-50"
                            >
                              {busyId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {isCamu && (
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Camu: {course.camu.subjectCode ?? '—'} {course.camu.sectionName ?? ''} · last synced{' '}
                    {formatDateTime(course.camu.lastSyncedAt)}
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">
                  Students <span className="font-normal text-gray-400 dark:text-slate-500">({course.students.length})</span>
                </h2>
                {course.students.length === 0 ? (
                  <div className={`${card} px-5 py-8 text-center text-sm text-gray-500 dark:text-ink-muted`}>
                    No active students enrolled.
                  </div>
                ) : (
                  <div className={`${card} overflow-x-auto`}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800 text-left">
                          <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">ID</th>
                          <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Name</th>
                          <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Program</th>
                          <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-ink-muted">Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {course.students.map((s) => (
                          <tr key={s.id} className="border-b border-gray-50 dark:border-slate-800/60 last:border-0">
                            <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted whitespace-nowrap">{s.studentId}</td>
                            <td className="px-5 py-2.5">
                              <Link to={`/admin/students/${s.id}`} className="text-gray-800 dark:text-ink-primary hover:underline">
                                {s.name}
                              </Link>
                              <span className="block text-xs text-gray-400 dark:text-slate-500">{s.email}</span>
                            </td>
                            <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted">{s.program || '—'}</td>
                            <td className="px-5 py-2.5 text-gray-500 dark:text-ink-muted">{s.year ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setQuery('') }}
        title="Add faculty"
        description="Link a faculty member Camu hasn't linked to this course."
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="w-full border border-gray-200 dark:border-bg-border bg-white dark:bg-bg-surface rounded-lg px-2.5 py-1.5 text-sm text-gray-700 dark:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ul className="mt-3 max-h-64 overflow-auto divide-y divide-gray-100 dark:divide-slate-800">
          {candidates.length === 0 && (
            <li className="py-4 text-sm text-center text-gray-400 dark:text-slate-500">No matching faculty</li>
          )}
          {candidates.map((f) => (
            <li key={f.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 dark:text-ink-primary">{f.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 break-all">{f.email}</p>
              </div>
              <button
                onClick={() => mutate(f.id, 'add')}
                disabled={busyId !== null}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-bg-elevated text-gray-700 dark:text-ink-secondary hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {busyId === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
