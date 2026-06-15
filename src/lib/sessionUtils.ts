import type { Session } from '../types'

export function sessionStartMs(session: Pick<Session, 'date' | 'startTime'>): number {
  return new Date(`${session.date}T${session.startTime}:00`).getTime()
}

/** Soonest session first (nearest in the future / most recent past at top of each group). */
export function sortSessionsNearestFirst(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => sessionStartMs(a) - sessionStartMs(b))
}

/** Most recent past session first. */
export function sortSessionsMostRecentFirst(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => sessionStartMs(b) - sessionStartMs(a))
}

export function groupSessionsByStatus(sessions: Session[]) {
  return {
    open: sortSessionsNearestFirst(sessions.filter((s) => s.status === 'open')),
    upcoming: sortSessionsNearestFirst(sessions.filter((s) => s.status === 'upcoming')),
    closed: sortSessionsMostRecentFirst(sessions.filter((s) => s.status === 'closed')),
  }
}

/** Students marked present — includes faculty overrides for closed sessions. */
export function sessionPresentCount(session: Session): number {
  if (session.status === 'closed' && session.presentCount !== undefined) {
    return session.presentCount
  }
  return session.submissionsCount
}

export function sessionAttendanceRate(session: Session): number {
  if (session.totalStudents <= 0) return 0
  return Math.round((sessionPresentCount(session) / session.totalStudents) * 100)
}
