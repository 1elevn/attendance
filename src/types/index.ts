export type Role = 'student' | 'faculty' | 'admin'

export type AttendanceStatus = 'recorded' | 'absent_excused' | 'absent_unexcused' | 'pending'

export type AbsenceReason =
  | 'location_undetected'
  | 'did_not_check_in'
  /** Student checked in, but only after the attendance window had closed. */
  | 'checked_in_late'

export interface Course {
  id: string
  code: string
  name: string
  department: string
  credits: number
  schedule: string
  room: string
  facultyId: string
  facultyName: string
  cohort: string
  cohortCode: string   // e.g. "CS201_A" — students use this to check in
  enrolledCount: number
}

export interface Session {
  id: string
  courseId: string
  cohortCode: string
  date: string
  startTime: string
  windowOpenTime: string
  windowCloseTime: string
  status: 'upcoming' | 'open' | 'processing' | 'closed'
  submissionsCount: number
  presentCount?: number
  totalStudents: number
  minSamples: number
  epsilon: number
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string    // MongoDB ObjectId — use studentCode for display
  studentCode: string  // human-readable student ID (e.g. "UG0012345")
  studentName: string
  status: AttendanceStatus
  submittedAt?: string
  note?: string
  absenceReason?: AbsenceReason
  overriddenBy?: string
  lat?: number
  lng?: number
}

export interface Student {
  id: string
  name: string
  email: string
  program: string
  year: number
}

export interface FacultyIntern {
  id: string
  name: string
  email: string
  department: string
  courseIds: string[]
}

export interface Admin {
  id: string
  name: string
  email: string
  department: string
}

export interface WeeklyMissReport {
  studentId: string
  studentName: string
  courseId: string
  courseName: string
  week: string
  excused: number
  unexcused: number
  total: number
}
