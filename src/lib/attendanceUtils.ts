import type { Session, AttendanceRecord, Course } from '../types'

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Returns the Monday (ISO week start) for a given date. */
export function getISOWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Returns a stable string key like "2026-W17" for grouping. */
export function weekKey(date: Date): string {
  const mon = getISOWeekStart(date)
  return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`
}

/** Parses a weekKey back into the Monday Date. */
export function parseWeekKey(key: string): Date {
  return new Date(key + 'T00:00:00Z')
}

/** Formats a week's Monday date as e.g. "Apr 21 – 27, 2026". */
export function formatWeekRange(mondayDate: Date): string {
  const sun = new Date(mondayDate)
  sun.setUTCDate(sun.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const year = sun.getUTCFullYear()
  return `${fmt(mondayDate)} – ${fmt(sun)}, ${year}`
}

/** Advances a weekKey by `delta` weeks (+1 or -1). */
export function shiftWeek(key: string, delta: number): string {
  const d = parseWeekKey(key)
  d.setUTCDate(d.getUTCDate() + delta * 7)
  return weekKey(d)
}

// ─── Course helpers ───────────────────────────────────────────────────────────

/**
 * Derives how many times per week a course meets from its schedule string.
 * E.g. "Mon / Wed / Fri · 08:00–09:00" → 3
 *      "Tue / Thu · 10:00–11:30"        → 2
 */
export function sessionsPerWeek(schedule: string): number {
  const daysPart = schedule.split('·')[0]
  return daysPart.split('/').length
}

/**
 * Threshold for flagging excessive unexcused absences, from how many sessions
 * actually ran and closed in that week — not from the timetable alone.
 *
 * Examples: No sessions closed → infinity (nothing to judge). One or two sessions
 * → one unexcused miss flags. Three or more closed sessions → need two unexcused.
 */
export function weeklyAbsenceThreshold(closedSessionsHeld: number): number {
  if (closedSessionsHeld <= 0) return Number.POSITIVE_INFINITY
  if (closedSessionsHeld >= 3) return 2
  return 1
}

// ─── Flag logic ───────────────────────────────────────────────────────────────

export interface WeeklyAbsenceSummary {
  studentId: string
  studentName: string
  courseId: string
  courseName: string
  courseCode: string
  scheduledSessions: number   // closed sessions that week
  excusedCount: number
  unexcusedCount: number
  isWeeklyFlagged: boolean    // threshold exceeded this week
  isRecurring: boolean        // flagged in ≥ 2 of the 4 most recent weeks
}

export type SessionDayStatus = 'attended' | 'absent_excused' | 'absent_unexcused'

/** What the admin API returns for each row: the summary plus per-session detail. */
export interface AdminWeeklyAbsenceSummary extends WeeklyAbsenceSummary {
  year: number | null
  /** Every faculty member on the course (instructors and FIs are not distinguished). */
  facultyNames: string[]
  /** One entry per closed session that week, in date order, with this student's outcome. */
  sessions: { date: string; startTime: string; status: SessionDayStatus }[]
}

/**
 * Computes per-student, per-course absence summaries for a given week.
 *
 * Only `closed` sessions with at least one attendance record are counted so
 * that incomplete/upcoming sessions don't skew the threshold check. The unexcused
 * flag threshold is derived from how many sessions actually closed that week
 * (`weeklyAbsenceThreshold`), not from the course schedule string alone.
 *
 * Flag thresholds (unexcused only, based on closed sessions that week):
 *   3+ closed sessions → unexcused ≥ 2
 *   1–2 closed sessions → unexcused ≥ 1
 *
 * Recurring: student meets the flag threshold in ≥ 2 of the 4 weeks ending
 * with (and including) the selected week.
 */
export function computeWeeklyAbsences(
  selectedWeekKey: string,
  courseFilter: string | null,
  sessions: Session[],
  attendance: AttendanceRecord[],
  courses: Course[],
): WeeklyAbsenceSummary[] {
  const courseMap = new Map(courses.map(c => [c.id, c]))
  const attBySession = new Map<string, AttendanceRecord[]>()
  for (const rec of attendance) {
    if (!attBySession.has(rec.sessionId)) attBySession.set(rec.sessionId, [])
    attBySession.get(rec.sessionId)!.push(rec)
  }

  // Collect the 4 most recent week keys up to and including selectedWeekKey
  const weekKeys: string[] = []
  let cursor = selectedWeekKey
  for (let i = 0; i < 4; i++) {
    weekKeys.push(cursor)
    cursor = shiftWeek(cursor, -1)
  }

  // Build (studentId+courseId) → per-week flag map across those 4 weeks
  type StudentCourseKey = string
  const flaggedByWeek = new Map<string, Set<StudentCourseKey>>()

  for (const wk of weekKeys) {
    flaggedByWeek.set(wk, new Set())
    const weeklySessions = sessions.filter(
      s => s.status === 'closed' && weekKey(new Date(s.date + 'T00:00:00Z')) === wk,
    )

    // Group closed sessions by course
    const byCourse = new Map<string, Session[]>()
    for (const s of weeklySessions) {
      if (!byCourse.has(s.courseId)) byCourse.set(s.courseId, [])
      byCourse.get(s.courseId)!.push(s)
    }

    for (const [courseId, courseSessions] of byCourse) {
      if (!courseMap.get(courseId)) continue
      const threshold = weeklyAbsenceThreshold(courseSessions.length)

      // Collect all students who have a record in at least one of these sessions
      const studentIds = new Set<string>()
      for (const s of courseSessions) {
        for (const r of attBySession.get(s.id) ?? []) {
          studentIds.add(r.studentId)
        }
      }

      for (const studentId of studentIds) {
        let unexcused = 0
        for (const s of courseSessions) {
          const rec = (attBySession.get(s.id) ?? []).find(r => r.studentId === studentId)
          if (rec?.status === 'absent_unexcused') unexcused++
        }
        if (unexcused >= threshold) {
          flaggedByWeek.get(wk)!.add(`${studentId}::${courseId}`)
        }
      }
    }
  }

  // Now build summaries for the selected week only
  const selectedSessions = sessions.filter(
    s => s.status === 'closed' && weekKey(new Date(s.date + 'T00:00:00Z')) === selectedWeekKey,
  )

  const byCourse = new Map<string, Session[]>()
  for (const s of selectedSessions) {
    if (!byCourse.has(s.courseId)) byCourse.set(s.courseId, [])
    byCourse.get(s.courseId)!.push(s)
  }

  const summaries: WeeklyAbsenceSummary[] = []

  for (const [courseId, courseSessions] of byCourse) {
    if (courseFilter && courseFilter !== courseId) continue
    const course = courseMap.get(courseId)
    if (!course) continue
    const threshold = weeklyAbsenceThreshold(courseSessions.length)

    const studentIds = new Set<string>()
    const studentNames = new Map<string, string>()
    for (const s of courseSessions) {
      for (const r of attBySession.get(s.id) ?? []) {
        studentIds.add(r.studentId)
        studentNames.set(r.studentId, r.studentName)
      }
    }

    for (const studentId of studentIds) {
      let excused = 0
      let unexcused = 0
      for (const s of courseSessions) {
        const rec = (attBySession.get(s.id) ?? []).find(r => r.studentId === studentId)
        if (rec?.status === 'absent_excused') excused++
        if (rec?.status === 'absent_unexcused') unexcused++
      }

      if (excused === 0 && unexcused === 0) continue // perfect attendance

      const key: StudentCourseKey = `${studentId}::${courseId}`
      const flaggedWeeksCount = weekKeys.filter(wk => flaggedByWeek.get(wk)?.has(key)).length
      const isWeeklyFlagged = unexcused >= threshold
      const isRecurring = flaggedWeeksCount >= 2

      summaries.push({
        studentId,
        studentName: studentNames.get(studentId) ?? studentId,
        courseId,
        courseName: course.name,
        courseCode: course.code,
        scheduledSessions: courseSessions.length,
        excusedCount: excused,
        unexcusedCount: unexcused,
        isWeeklyFlagged,
        isRecurring,
      })
    }
  }

  // Flagged first, then by student name
  summaries.sort((a, b) => {
    if (a.isWeeklyFlagged !== b.isWeeklyFlagged) return a.isWeeklyFlagged ? -1 : 1
    return a.studentName.localeCompare(b.studentName)
  })

  return summaries
}

/** Returns sorted unique week keys (descending, most recent first) from sessions. */
export function availableWeekKeys(sessions: Session[]): string[] {
  const keys = new Set<string>()
  for (const s of sessions) {
    if (s.status === 'closed') {
      keys.add(weekKey(new Date(s.date + 'T00:00:00Z')))
    }
  }
  return Array.from(keys).sort((a, b) => b.localeCompare(a))
}
