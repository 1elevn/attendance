import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAdminCourses,
  getAdminFaculty,
  updateAdminCourse,
  ApiError,
  type AdminFaculty,
} from '../../lib/api'
import type { Course } from '../../types'

interface SetupFormState {
  facultyIds: string[]
  schedule: string
  room: string
}

function emptyForm(): SetupFormState {
  return { facultyIds: [], schedule: '', room: '' }
}

export default function AdminCourses() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [faculty, setFaculty] = useState<AdminFaculty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SetupFormState>(emptyForm())
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')

  function load() {
    setIsLoading(true)
    Promise.all([getAdminCourses(), getAdminFaculty()])
      .then(([c, f]) => {
        setCourses(c)
        setFaculty(f)
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error('Failed to load courses')
        }
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (a.needsSetup !== b.needsSetup) return a.needsSetup ? -1 : 1
      return a.code.localeCompare(b.code)
    })
  }, [courses])

  // Matches every whitespace-separated term against code, name, department, cohort and faculty.
  const visibleCourses = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return sortedCourses
    return sortedCourses.filter((c) => {
      const haystack = [
        c.code, c.name, c.department, c.cohort, c.cohortCode, c.room, c.facultyName,
        ...(c.faculty ?? []).map((f) => f.name),
      ].join(' ').toLowerCase()
      return terms.every((t) => haystack.includes(t))
    })
  }, [sortedCourses, query])

  const needsSetupCount = courses.filter((c) => c.needsSetup).length

  function startEditing(course: Course) {
    setEditingId(course.id)
    setForm({
      facultyIds: course.facultyIds ?? [],
      schedule: course.schedule === 'Not yet scheduled' ? '' : (course.schedule ?? ''),
      room: course.room === 'TBD' ? '' : course.room,
    })
  }

  function cancelEditing() {
    setEditingId(null)
    setForm(emptyForm())
  }

  function toggleFaculty(facultyId: string) {
    setForm((f) => ({
      ...f,
      facultyIds: f.facultyIds.includes(facultyId)
        ? f.facultyIds.filter((id) => id !== facultyId)
        : [...f.facultyIds, facultyId],
    }))
  }

  async function saveSetup(courseId: string) {
    // Camu courses' faculty are managed on the course page (the sync would revert a direct edit).
    const isCamu = courses.find((c) => c.id === courseId)?.source === 'camu'
    if ((!isCamu && form.facultyIds.length === 0) || !form.schedule.trim() || !form.room.trim()) {
      toast.error(isCamu ? 'Schedule and room are required' : 'At least one faculty member, plus schedule and room, are required')
      return
    }
    setIsSaving(true)
    try {
      const updated = await updateAdminCourse(courseId, {
        ...(isCamu ? {} : { facultyIds: form.facultyIds }),
        schedule: form.schedule.trim(),
        room: form.room.trim(),
      })
      setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)))
      toast.success('Course set up successfully')
      cancelEditing()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update course')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-0 flex flex-col">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-bg-border px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-800 dark:text-ink-primary">Courses</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {query.trim() ? `${visibleCourses.length} of ${courses.length}` : courses.length} course{(query.trim() ? visibleCourses.length : courses.length) !== 1 ? 's' : ''}
              {needsSetupCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium"> · {needsSetupCount} need setup</span>
              )}
            </p>
          </div>
          <label className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, name, department, or faculty"
              aria-label="Search courses"
              className="border border-gray-200 dark:border-bg-border bg-gray-50 dark:bg-bg-elevated/40 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-ink-secondary w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {isLoading && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
              <div className="h-10 bg-gray-100 dark:bg-bg-elevated rounded" />
            </div>
          )}

          {!isLoading && sortedCourses.length === 0 && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700 dark:text-ink-secondary">No courses yet</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                Sync from Camu on the dashboard, or add courses manually.
              </p>
            </div>
          )}

          {!isLoading && sortedCourses.length > 0 && visibleCourses.length === 0 && (
            <div className="bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
              <p className="font-medium text-gray-700 dark:text-ink-secondary">No matching courses</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Nothing matches “{query.trim()}”.</p>
            </div>
          )}

          {!isLoading && visibleCourses.length > 0 && (
            <div className="space-y-3">
              {visibleCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => navigate(`/admin/courses/${course.id}`)}
                  className={`bg-white dark:bg-bg-surface border rounded-xl overflow-hidden cursor-pointer hover:shadow-sm transition-shadow ${
                    course.needsSetup ? 'border-amber-300 dark:border-amber-500/40' : 'border-gray-200 dark:border-bg-border'
                  }`}
                >
                  <div className="px-4 sm:px-5 py-4 flex flex-wrap sm:flex-nowrap items-start justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 dark:text-ink-primary">{course.code}</p>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{course.name}</span>
                        {course.source === 'camu' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-1.5 py-0.5 rounded-full">
                            Camu
                          </span>
                        )}
                        {course.needsSetup ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            Needs setup
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Ready
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        {course.department} · {course.cohort} · {course.enrolledCount} enrolled
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        {course.faculty && course.faculty.length > 0
                          ? course.faculty.map((f) => f.name).join(', ')
                          : course.facultyName || 'Unassigned'}{' '}
                        · {course.schedule} · {course.room}
                      </p>
                    </div>

                    <ChevronRight className="hidden sm:block w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0 mt-1 order-last" />
                    {course.needsSetup && editingId !== course.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(course) }}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                      >
                        Set up
                      </button>
                    )}
                  </div>

                  {editingId === course.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="px-5 pb-4 pt-1 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-bg-elevated/30 cursor-default"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        {course.source === 'camu' ? (
                          <div className="block">
                            <span className="text-xs font-medium text-gray-500 dark:text-ink-muted">Faculty</span>
                            <p className="mt-1 text-xs text-gray-500 dark:text-ink-muted">
                              Camu course — link faculty on the{' '}
                              <Link to={`/admin/courses/${course.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                course page
                              </Link>
                              .
                            </p>
                          </div>
                        ) : (
                        <div className="block">
                          <span className="text-xs font-medium text-gray-500 dark:text-ink-muted">
                            Faculty (lecturer + any FIs — all can take attendance)
                          </span>
                          <div className="mt-1 w-full border border-gray-200 dark:border-bg-border bg-white dark:bg-bg-surface rounded-lg px-2.5 py-1.5 max-h-32 overflow-auto space-y-1">
                            {faculty.map((f) => (
                              <label key={f.id} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-ink-secondary">
                                <input
                                  type="checkbox"
                                  checked={form.facultyIds.includes(f.id)}
                                  onChange={() => toggleFaculty(f.id)}
                                  className="rounded border-gray-300 dark:border-slate-600"
                                />
                                {f.name}
                              </label>
                            ))}
                          </div>
                        </div>
                        )}
                        <label className="block">
                          <span className="text-xs font-medium text-gray-500 dark:text-ink-muted">Schedule</span>
                          <input
                            value={form.schedule}
                            onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                            placeholder="Mon/Wed 13:15–14:45"
                            className="mt-1 w-full border border-gray-200 dark:border-bg-border bg-white dark:bg-bg-surface rounded-lg px-2.5 py-1.5 text-sm text-gray-700 dark:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-gray-500 dark:text-ink-muted">Room</span>
                          <input
                            value={form.room}
                            onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                            placeholder="RB 100"
                            className="mt-1 w-full border border-gray-200 dark:border-bg-border bg-white dark:bg-bg-surface rounded-lg px-2.5 py-1.5 text-sm text-gray-700 dark:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => saveSetup(course.id)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={isSaving}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-500 dark:text-ink-muted hover:bg-gray-100 dark:hover:bg-bg-elevated transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
