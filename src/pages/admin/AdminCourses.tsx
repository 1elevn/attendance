import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
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
  facultyId: string
  schedule: string
  room: string
}

function emptyForm(): SetupFormState {
  return { facultyId: '', schedule: '', room: '' }
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [faculty, setFaculty] = useState<AdminFaculty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SetupFormState>(emptyForm())
  const [isSaving, setIsSaving] = useState(false)

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

  const needsSetupCount = courses.filter((c) => c.needsSetup).length

  function startEditing(course: Course) {
    setEditingId(course.id)
    setForm({
      facultyId: course.facultyId ?? '',
      schedule: course.schedule === 'Not yet scheduled' ? '' : course.schedule,
      room: course.room === 'TBD' ? '' : course.room,
    })
  }

  function cancelEditing() {
    setEditingId(null)
    setForm(emptyForm())
  }

  async function saveSetup(courseId: string) {
    if (!form.facultyId || !form.schedule.trim() || !form.room.trim()) {
      toast.error('Faculty, schedule, and room are all required')
      return
    }
    setIsSaving(true)
    try {
      const updated = await updateAdminCourse(courseId, {
        facultyId: form.facultyId,
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
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Courses</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {courses.length} course{courses.length !== 1 ? 's' : ''}
              {needsSetupCount > 0 && (
                <span className="text-amber-600 font-medium"> · {needsSetupCount} need setup</span>
              )}
            </p>
          </div>
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

          {!isLoading && sortedCourses.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-gray-700">No courses yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Sync from Camu on the dashboard, or add courses manually.
              </p>
            </div>
          )}

          {!isLoading && sortedCourses.length > 0 && (
            <div className="space-y-3">
              {sortedCourses.map((course) => (
                <div
                  key={course.id}
                  className={`bg-white border rounded-xl overflow-hidden ${
                    course.needsSetup ? 'border-amber-300' : 'border-gray-200'
                  }`}
                >
                  <div className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{course.code}</p>
                        <span className="text-xs text-gray-400">{course.name}</span>
                        {course.source === 'camu' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                            Camu
                          </span>
                        )}
                        {course.needsSetup ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            Needs setup
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Ready
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {course.department} · {course.cohort} · {course.enrolledCount} enrolled
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {course.facultyName || 'Unassigned'} · {course.schedule} · {course.room}
                      </p>
                    </div>

                    {course.needsSetup && editingId !== course.id && (
                      <button
                        onClick={() => startEditing(course)}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                      >
                        Set up
                      </button>
                    )}
                  </div>

                  {editingId === course.id && (
                    <div className="px-5 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        <label className="block">
                          <span className="text-xs font-medium text-gray-500">Faculty</span>
                          <select
                            value={form.facultyId}
                            onChange={(e) => setForm((f) => ({ ...f, facultyId: e.target.value }))}
                            className="mt-1 w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select faculty</option>
                            {faculty.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-gray-500">Schedule</span>
                          <input
                            value={form.schedule}
                            onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                            placeholder="Mon/Wed 13:15–14:45"
                            className="mt-1 w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-gray-500">Room</span>
                          <input
                            value={form.room}
                            onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                            placeholder="RB 100"
                            className="mt-1 w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
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
