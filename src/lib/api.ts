import { useAppStore } from '../store'
import type { Session, AttendanceRecord, AttendanceStatus, AbsenceReason, Course } from '../types'
import type { WeeklyAbsenceSummary } from './attendanceUtils'

const BASE: string =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '')

if (import.meta.env.PROD && !BASE) {
  throw new Error('VITE_API_BASE_URL must be set for production builds')
}

// ─── Error type ───────────────────────────────────────────────────────────────

/** User-facing message from a failed API response (`message`, else `error`). */
export function getApiErrorMessage(
  err: { status: number; body: Record<string, unknown> },
): string {
  const { body } = err
  if (typeof body.message === 'string' && body.message.trim()) {
    return body.message
  }
  if (typeof body.error === 'string' && body.error.trim()) {
    return body.error
  }
  return 'Something went wrong. Please try again.'
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(getApiErrorMessage({ status, body }))
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { token: string }
    useAppStore.getState().setToken(data.token)
    return data.token
  } catch {
    return null
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAppStore.getState().token

  const makeRequest = async (tok: string | null) => {
    const hasBody = init?.body !== undefined && init?.body !== null
    const headers: Record<string, string> = {
      ...authHeaders(tok),
      ...(init?.headers as Record<string, string> | undefined),
    }
    if (hasBody && !('Content-Type' in headers)) {
      headers['Content-Type'] = 'application/json'
    }

    return fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })
  }

  let res = await makeRequest(token)

  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (newToken) {
      res = await makeRequest(newToken)
    } else {
      useAppStore.getState().logout()
      throw new ApiError(401, { error: 'Session expired' })
    }
  }

  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return apiFetch<{ token: string; user: { id: string; name: string; role: 'faculty' | 'admin' } }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  )
}

export async function apiLogout() {
  return apiFetch<void>('/auth/logout', { method: 'POST' })
}

// ─── Students ─────────────────────────────────────────────────────────────────

export type StudentInfo = { id: string; name: string; email: string; program: string; year: number }

export async function getStudent(id: string) {
  return apiFetch<StudentInfo>(`/students/${id}`)
}

export interface CourseAbsences {
  courseId: string
  courseCode: string
  courseName: string
  absences: {
    sessionId: string
    date: string
    startTime: string
    status: AttendanceStatus
    note?: string
    absenceReason?: AbsenceReason
    /** When the student actually checked in, if they did. ISO 8601. */
    submittedAt?: string
    sessionStatus: Session['status']
  }[]
}

export async function getStudentAbsences(id: string) {
  return apiFetch<CourseAbsences[]>(`/students/${id}/absences`)
}

export interface CourseAbsenceRecord {
  sessionId: string
  date: string
  startTime: string
  status: AttendanceStatus
  absenceReason?: AbsenceReason
  /** When the student actually checked in, if they did. ISO 8601. */
  submittedAt?: string
  note?: string
  overriddenBy?: string
}

export async function getCourseAbsences(studentId: string, courseId: string) {
  return apiFetch<CourseAbsenceRecord[]>(`/students/${studentId}/courses/${courseId}/absences`)
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function submitAttendance(body: {
  cohortCode: string
  studentId: string
  lat: number
  lng: number
  deviceFingerprint?: string
  deviceType?: 'laptop' | 'mobile'
}) {
  return apiFetch<{
    /** 'recorded' when on time, 'late' when the window had already closed. */
    status: 'recorded' | 'late'
    recordedAt: string
    courseName: string
    courseCode: string
  }>('/attendance/submit', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateAttendanceRecord(
  recordId: string,
  body: { status?: AttendanceStatus; note?: string; absenceReason?: AbsenceReason },
) {
  return apiFetch<AttendanceRecord>(`/attendance/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// ─── Faculty ──────────────────────────────────────────────────────────────────

export type CourseWithSession = Course & {
  latestSession: {
    _id: string
    status: Session['status']
    date: string
    startTime: string
    windowCloseTime: string
    submissionsCount: number
    totalStudents: number
  } | null
}

export async function getMyCourses() {
  return apiFetch<CourseWithSession[]>('/faculty/me/courses')
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function getCourseSessions(courseId: string) {
  return apiFetch<Session[]>(`/courses/${courseId}/sessions`)
}

export async function createSession(
  courseId: string,
  body: { date: string; startTime: string; windowDuration: number; minSamples: number; epsilon: number },
) {
  return apiFetch<Session>(`/courses/${courseId}/sessions`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getSession(sessionId: string) {
  return apiFetch<Session>(`/sessions/${sessionId}`)
}

export async function deleteSession(sessionId: string) {
  return apiFetch<void>(`/sessions/${sessionId}`, { method: 'DELETE' })
}

export async function updateSession(
  sessionId: string,
  body: { date: string; startTime: string; windowDuration: number; minSamples: number; epsilon: number },
) {
  return apiFetch<Session>(`/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function getLiveSession(sessionId: string) {
  return apiFetch<{ submissionsCount: number; secondsRemaining: number; status: Session['status'] }>(
    `/sessions/${sessionId}/live`,
  )
}

export async function closeSession(sessionId: string) {
  return apiFetch<Session>(`/sessions/${sessionId}/close`, { method: 'PATCH' })
}

export async function getSessionAttendance(sessionId: string) {
  return apiFetch<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`)
}

// ─── SSE live stream ──────────────────────────────────────────────────────────

export interface LiveTick {
  submissionsCount: number
  secondsRemaining: number
  status: Session['status']
}

export function openLiveStream(
  sessionId: string,
  onTick: (data: LiveTick) => void,
  onClosed: () => void,
): () => void {
  const token = useAppStore.getState().token
  const controller = new AbortController()

  fetch(`${BASE}/sessions/${sessionId}/live/stream`, {
    headers: authHeaders(token),
    credentials: 'include',
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const lines = chunk.split('\n')
          const event = lines.find(l => l.startsWith('event:'))?.slice(6).trim()
          const dataLine = lines.find(l => l.startsWith('data:'))
          if (!dataLine) continue
          try {
            const data = JSON.parse(dataLine.slice(5).trim()) as LiveTick
            if (event === 'tick') onTick(data)
            else if (event === 'closed') onClosed()
          } catch {
            // ignore malformed SSE frames
          }
        }
      }
    })
    .catch(() => {
      // stream aborted or network error — handled by caller
    })

  return () => controller.abort()
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getWeeklyAbsences(week: string, courseId?: string) {
  const params = new URLSearchParams({ week })
  if (courseId) params.set('courseId', courseId)
  return apiFetch<WeeklyAbsenceSummary[]>(`/admin/weekly-absences?${params}`)
}

export async function getAdminCourses() {
  return apiFetch<Course[]>('/admin/courses')
}

export interface AdminStudent {
  id: string
  studentId: string
  name: string
  email: string
  program: string
  year: number
  cohortCode: string
  courseIds: string[]
}

export async function getAdminStudents(opts?: { limit?: number; page?: number; q?: string }) {
  const params = new URLSearchParams({
    limit: String(opts?.limit ?? 20),
    page: String(opts?.page ?? 1),
  })
  if (opts?.q) params.set('q', opts.q)
  return apiFetch<{ data: AdminStudent[]; total: number; page: number; limit: number; pages: number }>(
    `/admin/students?${params}`,
  )
}

export function getExportUrl(week: string, format: 'csv' | 'json', courseId?: string) {
  const params = new URLSearchParams({ week, format })
  if (courseId) params.set('courseId', courseId)
  const token = useAppStore.getState().token
  if (token) params.set('token', token)
  return `${BASE}/admin/reports/export?${params}`
}
