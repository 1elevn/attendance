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

export async function validateActivationToken(token: string) {
  return apiFetch<{ name: string }>(`/auth/activate/${token}`)
}

export async function activateAccount(token: string, password: string) {
  return apiFetch<{ token: string; user: { id: string; name: string; role: 'faculty' | 'admin' } }>(
    '/auth/activate',
    { method: 'POST', body: JSON.stringify({ token, password }) },
  )
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
    status: AttendanceStatus
    note?: string
    absenceReason?: AbsenceReason
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
}) {
  return apiFetch<{ status: string; courseName: string; courseCode: string }>(
    '/attendance/submit',
    { method: 'POST', body: JSON.stringify(body) },
  )
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

export async function updateAdminCourse(
  courseId: string,
  body: Partial<{
    code: string
    name: string
    department: string
    credits: number
    schedule: string
    room: string
    facultyIds: string[]
    cohort: string
    cohortCode: string
    enrolledCount: number
  }>,
) {
  return apiFetch<Course>(`/admin/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export interface AdminFaculty {
  id: string
  name: string
  email: string
  department: string
  source: 'camu' | 'manual'
  activated: boolean
  invitedAt: string | null
}

export async function getAdminFaculty() {
  return apiFetch<AdminFaculty[]>('/admin/faculty')
}

export async function sendFacultyInvite(id: string) {
  return apiFetch<{ invitedAt: string }>(`/admin/faculty/${id}/invite`, { method: 'POST' })
}

export interface BulkInviteResult {
  sent: number
  failed: number
  failures: { email: string; error: string }[]
}

export async function sendBulkFacultyInvites() {
  return apiFetch<BulkInviteResult>('/admin/faculty/invite-bulk', { method: 'POST' })
}

// ─── Camu sync ────────────────────────────────────────────────────────────────

export interface CamuSyncResult {
  id: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  status: 'running' | 'success' | 'partial' | 'error'
  trigger: 'manual' | 'scheduled' | 'cli'
  triggeredBy: string | null
  triggeredByName: string | null
  academicYear: string | null
  semester: string | null
  rosterPagesFetched: number
  rosterRowsFetched: number
  enrolmentRowsFetched: number
  studentsCreated: number
  studentsUpdated: number
  studentsDeactivated: number
  coursesCreated: number
  facultyAccountsCreated: number
  enrollmentsLinked: number
  enrollmentsUnlinked: number
  errorCount: number
  errors: string[]
  warnings: string[]
}

export async function triggerCamuSync() {
  return apiFetch<CamuSyncResult>('/admin/camu/sync', { method: 'POST' })
}

export async function getCamuSyncStatus() {
  return apiFetch<CamuSyncResult | null>('/admin/camu/sync/status')
}

export async function getCamuSyncHistory(opts?: { page?: number; limit?: number }) {
  const params = new URLSearchParams({
    page: String(opts?.page ?? 1),
    limit: String(opts?.limit ?? 20),
  })
  return apiFetch<{ data: CamuSyncResult[]; total: number; page: number; limit: number; pages: number }>(
    `/admin/camu/sync/history?${params}`,
  )
}

export interface AdminStudent {
  id: string
  studentId: string
  name: string
  email: string
  program: string
  year: number
  cohortCode?: string
  courseIds: string[]
  courseCount: number
  source: 'manual' | 'camu'
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

/**
 * Pages through every admin student, capped at 20 pages (2000 students) —
 * /admin/students clamps limit to 100 server-side, so a naive limit:1000
 * request silently truncates. Use only where the full set is genuinely
 * needed (e.g. building filter option lists); prefer getAdminStudents with
 * pagination for anything rendered as a list.
 */
export async function fetchAllAdminStudents(): Promise<AdminStudent[]> {
  const all: AdminStudent[] = []
  let page = 1
  for (;;) {
    const res = await getAdminStudents({ limit: 100, page })
    all.push(...res.data)
    if (page >= res.pages || page >= 20) break
    page++
  }
  return all
}

export function getExportUrl(week: string, format: 'csv' | 'json', courseId?: string) {
  const params = new URLSearchParams({ week, format })
  if (courseId) params.set('courseId', courseId)
  const token = useAppStore.getState().token
  if (token) params.set('token', token)
  return `${BASE}/admin/reports/export?${params}`
}
