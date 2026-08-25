import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Flag, AlertTriangle, Search, Pin, PinOff, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getWeeklyAbsences, getAdminCourses, getAdminStudents, triggerCamuSync, ApiError } from '../../lib/api'
import type { AdminStudent } from '../../lib/api'
import type { Course } from '../../types'
import {
  parseWeekKey,
  formatWeekRange,
  shiftWeek,
  getISOWeekStart,
  weekKey,
  type WeeklyAbsenceSummary,
} from '../../lib/attendanceUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentWeekKey(): string {
  return weekKey(new Date())
}

function relativeWeekLabel(key: string): string {
  const selectedMonday = parseWeekKey(key)
  const currentMonday = getISOWeekStart(new Date())
  const diffWeeks = Math.round(
    (currentMonday.getTime() - selectedMonday.getTime()) / (1000 * 60 * 60 * 24 * 7),
  )
  if (diffWeeks === 0) return 'This week'
  if (diffWeeks === 1) return 'Last week'
  if (diffWeeks > 1) return `${diffWeeks} weeks ago`
  return 'Upcoming'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekKey())
  const [courseFilter, setCourseFilter] = useState<string>('')
  const [studentSearch, setStudentSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('')
  const [statusFilters, setStatusFilters] = useState({
    flagged: false,
    recurring: false,
    unexcused: false,
  })
  const [pinnedStudentIds, setPinnedStudentIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const [summaries, setSummaries] = useState<WeeklyAbsenceSummary[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [students, setStudents] = useState<AdminStudent[]>([])

  // Load static data (courses + students)
  const loadStaticData = useCallback(() => {
    Promise.all([
      getAdminCourses(),
      getAdminStudents({ limit: 1000 }),
    ]).then(([c, s]) => {
      setCourses(c)
      setStudents(s.data)
    }).catch(() => {})
  }, [])

  useEffect(loadStaticData, [loadStaticData])

  async function handleCamuSync() {
    setIsSyncing(true)
    try {
      const result = await triggerCamuSync()
      if (result.status === 'error') {
        toast.error(
          `Sync completed with ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}. ` +
          `${result.studentsCreated + result.studentsUpdated} students, ${result.coursesCreated} new courses.`,
        )
      } else {
        toast.success(
          `Synced ${result.studentsCreated} new / ${result.studentsUpdated} updated students, ` +
          `${result.coursesCreated} new courses, ${result.enrollmentsLinked} enrollments linked.`,
        )
      }
      loadStaticData()
      loadAbsences()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Camu sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  // Load weekly absences whenever week/course changes
  const loadAbsences = useCallback(() => {
    setIsLoading(true)
    getWeeklyAbsences(selectedWeek, courseFilter || undefined)
      .then(setSummaries)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          setSummaries([])
        }
      })
      .finally(() => setIsLoading(false))
  }, [selectedWeek, courseFilter])

  useEffect(() => { loadAbsences() }, [loadAbsences])

  // Re-trigger loading indicator on filter changes (data is client-side filtered)
  useEffect(() => {
    setIsLoading(true)
    const t = window.setTimeout(() => setIsLoading(false), 150)
    return () => window.clearTimeout(t)
  }, [studentSearch, programFilter, yearFilter, statusFilters.flagged, statusFilters.recurring, statusFilters.unexcused])

  const studentMap = useMemo(
    () => new Map(students.map(s => [s.id, s])),
    [students],
  )

  const canGoNext = selectedWeek < currentWeekKey()
  const canGoPrev = true

  function navigateWeek(dir: -1 | 1) {
    setSelectedWeek(prev => shiftWeek(prev, dir))
  }

  const weekLabel = selectedWeek ? formatWeekRange(parseWeekKey(selectedWeek)) : 'No data'
  const relLabel  = selectedWeek ? relativeWeekLabel(selectedWeek) : ''

  const flaggedCount   = summaries.filter(s => s.isWeeklyFlagged).length
  const recurringCount = summaries.filter(s => s.isRecurring && !s.isWeeklyFlagged).length

  const programs = useMemo(
    () => Array.from(new Set(students.map(s => s.program).filter(Boolean))).sort(),
    [students],
  )
  const years = useMemo(
    () => Array.from(new Set(students.map(s => s.year).filter(Boolean))).sort((a, b) => a - b),
    [students],
  )

  const filteredSummaries = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    let list = summaries.filter((s) => {
      const student = studentMap.get(s.studentId)

      if (q) {
        const haystack = `${s.studentName} ${student?.program ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (programFilter && student?.program !== programFilter) return false
      if (yearFilter && String(student?.year) !== yearFilter) return false
      if (statusFilters.flagged && !s.isWeeklyFlagged) return false
      if (statusFilters.recurring && !s.isRecurring) return false
      if (statusFilters.unexcused && s.unexcusedCount === 0) return false
      return true
    })

    list = [...list].sort((a, b) => {
      const aPinned = pinnedStudentIds.has(a.studentId) ? 1 : 0
      const bPinned = pinnedStudentIds.has(b.studentId) ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      if (a.isWeeklyFlagged !== b.isWeeklyFlagged) return Number(b.isWeeklyFlagged) - Number(a.isWeeklyFlagged)
      if (a.isRecurring !== b.isRecurring) return Number(b.isRecurring) - Number(a.isRecurring)
      return b.unexcusedCount - a.unexcusedCount
    })
    return list
  }, [summaries, studentSearch, programFilter, yearFilter, statusFilters, studentMap, pinnedStudentIds])

  function toggleStatusFilter(key: 'flagged' | 'recurring' | 'unexcused') {
    setStatusFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function togglePinnedStudent(studentId: string) {
    setPinnedStudentIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  useEffect(() => {
    const saved = window.localStorage.getItem('adminPinnedStudents')
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as string[]
      setPinnedStudentIds(new Set(parsed))
    } catch {
      // Ignore malformed saved pins.
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('adminPinnedStudents', JSON.stringify(Array.from(pinnedStudentIds)))
  }, [pinnedStudentIds])

  const pinnedStudents = useMemo(
    () => students.filter((s) => pinnedStudentIds.has(s.id)),
    [pinnedStudentIds, students],
  )

  return (
    <div className="min-h-0 flex flex-col">

      {/* ── Sticky toolbar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">

          {/* Week nav */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-1 py-1">
            <button
              onClick={() => navigateWeek(-1)}
              disabled={!canGoPrev}
              className="p-1.5 rounded-md text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-25 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 text-center min-w-[210px]">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block leading-none mb-0.5">
                {relLabel}
              </span>
              <span className="text-sm font-medium text-gray-800">{weekLabel}</span>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              disabled={!canGoNext}
              className="p-1.5 rounded-md text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-25 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Course filter */}
          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>

          {/* Student search */}
          <label className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Search student or program"
              className="border border-gray-200 bg-gray-50 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {programs.length > 0 && (
            <select
              value={programFilter}
              onChange={e => setProgramFilter(e.target.value)}
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All programs</option>
              {programs.map((program) => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
          )}

          {years.length > 0 && (
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All years</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>Year {year}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleStatusFilter('flagged')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                statusFilters.flagged
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Flagged
            </button>
            <button
              onClick={() => toggleStatusFilter('recurring')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                statusFilters.recurring
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Recurring
            </button>
            <button
              onClick={() => toggleStatusFilter('unexcused')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                statusFilters.unexcused
                  ? 'bg-gray-100 text-gray-700 border-gray-300'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Unexcused
            </button>
          </div>

          {/* Camu sync */}
          <button
            onClick={handleCamuSync}
            disabled={isSyncing}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Pull students and enrollments from Camu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing…' : 'Sync from Camu'}
          </button>

          {/* Summary pills */}
          {!isLoading && filteredSummaries.length > 0 && (
            <div className="flex items-center gap-2">
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full">
                  <Flag className="w-3 h-3 fill-red-500" />
                  {flaggedCount} flagged
                </span>
              )}
              {recurringCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  {recurringCount} recurring
                </span>
              )}
              {flaggedCount === 0 && recurringCount === 0 && (
                <span className="text-xs text-gray-400">
                  {filteredSummaries.length} student{filteredSummaries.length !== 1 ? 's' : ''} shown
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Loading state */}
          {isLoading && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          )}

          {/* Main content */}
          {!isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
              {/* Pinned students rail */}
              <aside className="bg-white border border-gray-200 rounded-xl overflow-hidden lg:sticky lg:top-24">
                <AnimatePresence initial={false}>
                  {pinnedStudents.length === 0 && (
                    <motion.div
                      key="pinned-rail-intro"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden border-b border-gray-100"
                    >
                      <div className="px-4 py-3">
                        <h3 className="text-sm font-semibold text-gray-700">Pinned students</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Always visible for quick follow-up</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {pinnedStudents.length === 0 ? (
                  <div className="px-4 py-5 text-xs text-gray-400">
                    Pin from the table to keep students here whenever you return.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pinnedStudents.map((student) => (
                      <div key={student.id} className="px-4 py-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{student.name}</p>
                          <p className="text-xs text-gray-400 truncate">{student.program} · Year {student.year}</p>
                          <button
                            onClick={() => navigate(`/history?id=${student.studentId}`)}
                            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            View history
                          </button>
                        </div>
                        <button
                          onClick={() => togglePinnedStudent(student.id)}
                          className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          title="Unpin student"
                        >
                          <PinOff className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </aside>

              {filteredSummaries.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-3">
                    <span className="text-lg">✓</span>
                  </div>
                  <p className="font-medium text-gray-700">
                    {summaries.length === 0 ? 'No absences this week' : 'No students match these filters'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {summaries.length === 0
                      ? 'All recorded sessions show full attendance.'
                      : 'Try another week/course or clear one or more filters.'}
                  </p>
                </div>
              ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Legend */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  Absences · {relLabel}
                </h2>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Unexcused miss
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Attended
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flag className="w-3 h-3 text-red-500 fill-red-500" />
                    Threshold exceeded
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    Recurring pattern
                  </span>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left bg-gray-50/95 sticky top-0 z-10 backdrop-blur-sm">
                    <th className="px-3 py-2.5 font-medium text-gray-500 text-center w-14">Pin</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500 w-1" />
                    <th className="px-5 py-2.5 font-medium text-gray-500">Student</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500">Course</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500">Sessions this week</th>
                    <th className="px-5 py-2.5 font-medium text-gray-500 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSummaries.map(s => (
                    <AbsenceRow
                      key={`${s.studentId}-${s.courseId}`}
                      summary={s}
                      student={studentMap.get(s.studentId)}
                      isPinned={pinnedStudentIds.has(s.studentId)}
                      onTogglePin={togglePinnedStudent}
                    />
                  ))}
                </tbody>
              </table>
            </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionDots({
  scheduledSessions,
  unexcusedCount,
  excusedCount,
}: {
  scheduledSessions: number
  unexcusedCount: number
  excusedCount: number
}) {
  const attended = scheduledSessions - unexcusedCount - excusedCount

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: unexcusedCount }).map((_, i) => (
          <span
            key={`u${i}`}
            className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"
            title="Unexcused absence"
          />
        ))}
        {Array.from({ length: Math.max(0, attended) }).map((_, i) => (
          <span
            key={`a${i}`}
            className="w-2.5 h-2.5 rounded-full bg-emerald-400"
            title="Attended"
          />
        ))}
      </div>
      {excusedCount > 0 && (
        <span className="text-xs text-gray-400">+{excusedCount} excused</span>
      )}
    </div>
  )
}

function AbsenceRow({
  summary: s,
  student,
  isPinned,
  onTogglePin,
}: {
  summary: WeeklyAbsenceSummary
  student: AdminStudent | undefined
  isPinned: boolean
  onTogglePin: (studentId: string) => void
}) {
  const accentClass = s.isWeeklyFlagged
    ? 'border-l-red-500 bg-red-50/30'
    : s.isRecurring
    ? 'border-l-amber-400 bg-amber-50/20'
    : 'border-l-transparent'

  return (
    <tr className={`border-l-4 ${accentClass} transition-colors`}>
      <td className="px-3 py-3.5 text-center">
        <button
          onClick={() => onTogglePin(s.studentId)}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
            isPinned
              ? 'border-blue-200 bg-blue-50 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title={isPinned ? 'Unpin student row' : 'Pin student row to top'}
        >
          {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </button>
      </td>
      {/* Accent spacer — the left border does the work */}
      <td className="w-1" />

      {/* Student */}
      <td className="px-5 py-3.5">
        <p className={`font-semibold leading-tight ${s.isWeeklyFlagged ? 'text-gray-900' : 'text-gray-800'}`}>
          {s.studentName}
        </p>
        {student && (
          <p className="text-xs text-gray-400 mt-0.5">
            {student.program} · Year {student.year}
          </p>
        )}
      </td>

      {/* Course */}
      <td className="px-5 py-3.5">
        <p className="font-medium text-gray-800">{s.courseCode}</p>
        <p className="text-xs text-gray-400 mt-0.5">{s.courseName}</p>
      </td>

      {/* Session dots */}
      <td className="px-5 py-3.5">
        <SessionDots
          scheduledSessions={s.scheduledSessions}
          unexcusedCount={s.unexcusedCount}
          excusedCount={s.excusedCount}
        />
      </td>

      {/* Status badges */}
      <td className="px-5 py-3.5 text-center">
        <div className="flex items-center justify-center gap-2">
          {s.isWeeklyFlagged && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full"
              title="Missed enough sessions to exceed the threshold this week"
            >
              <Flag className="w-3 h-3 fill-red-500" />
              Flagged
            </span>
          )}
          {s.isRecurring && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full"
              title="Has been flagged in 2 or more of the last 4 weeks"
            >
              <AlertTriangle className="w-3 h-3" />
              Recurring
            </span>
          )}
          {!s.isWeeklyFlagged && !s.isRecurring && (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </div>
      </td>
    </tr>
  )
}
