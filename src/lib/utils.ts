import { clsx, type ClassValue } from 'clsx'
import type { AttendanceStatus, AbsenceReason } from '../types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** For upcoming session labels — shows "today" when the session date is today. */
export function formatNextSessionDate(dateStr: string) {
  const session = new Date(`${dateStr.slice(0, 10)}T12:00:00`)
  const now = new Date()
  if (
    session.getFullYear() === now.getFullYear() &&
    session.getMonth() === now.getMonth() &&
    session.getDate() === now.getDate()
  ) {
    return 'Today'
  }
  return formatDate(dateStr)
}

export function statusLabel(status: AttendanceStatus) {
  const map: Record<AttendanceStatus, string> = {
    recorded: 'Recorded',
    absent_excused: 'Absent · Excused',
    absent_unexcused: 'Absent · Unexcused',
    pending: 'Pending',
  }
  return map[status]
}

export function statusColors(status: AttendanceStatus) {
  const map: Record<AttendanceStatus, string> = {
    recorded: 'text-success bg-success/10 border-success/20',
    absent_excused: 'text-warning bg-warning/10 border-warning/20',
    absent_unexcused: 'text-danger bg-danger/10 border-danger/20',
    pending: 'text-ink-secondary bg-ink-primary/5 border-ink-primary/10',
  }
  return map[status]
}

export function absenceReasonLabel(reason: AbsenceReason): string {
  const map: Record<AbsenceReason, string> = {
    location_undetected: 'Location undetected',
    did_not_check_in: 'Did not check in',
    checked_in_late: 'Checked in late',
  }
  return map[reason]
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
