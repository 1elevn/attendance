import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, MapPin, AlertCircle, GraduationCap } from 'lucide-react'
import { getStudent, getCourseAbsences, ApiError } from '../../lib/api'
import type { StudentInfo, CourseAbsenceRecord } from '../../lib/api'
import { StatusBadge } from '../../components/ui/Badge'
import { formatDate, cn, absenceReasonLabel } from '../../lib/utils'
import { usePageTitle } from '../../hooks/usePageTitle'

export default function CourseAttendanceDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const studentId = searchParams.get('id') || ''
  const courseId = searchParams.get('course') || ''

  // Course name/code may be passed via navigation state from AttendanceHistory
  const courseCode: string = (location.state as { courseCode?: string } | null)?.courseCode ?? ''
  const courseName: string = (location.state as { courseName?: string } | null)?.courseName ?? ''
  usePageTitle(courseCode || 'Course Detail')

  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [absences, setAbsences] = useState<CourseAbsenceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId || !courseId) { setLoading(false); return }
    let cancelled = false

    Promise.all([
      getStudent(studentId),
      getCourseAbsences(studentId, courseId),
    ])
      .then(([s, recs]) => {
        if (cancelled) return
        setStudent(s)
        setAbsences(recs)
      })
      .catch((err) => {
        if (cancelled) return
        if (!(err instanceof ApiError)) console.error(err)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [studentId, courseId])

  // The endpoint returns late sessions alongside absences so the student can see
  // the timestamp. A late arrival is not an absence and must not be counted as one.
  const unexcused = absences.filter(a => a.status === 'absent_unexcused').length
  const excused = absences.filter(a => a.status === 'absent_excused').length
  const late = absences.filter(a => a.status === 'late').length
  const absenceCount = unexcused + excused

  return (
    <div className="min-h-screen p-5 dot-grid">
      <div className="max-w-md mx-auto flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink-primary leading-none">{courseCode || '—'}</p>
              <p className="text-xs text-ink-muted mt-0.5 truncate max-w-[200px]">{courseName}</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="p-4 rounded-2xl bg-bg-card border border-bg-border animate-pulse h-20" />
        )}

        {/* Student + absence summary */}
        {!loading && student && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-bg-card border border-bg-border shadow-sm flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-xs text-ink-muted">{studentId}</p>
              <p className="text-sm font-semibold text-ink-primary">{student.name}</p>
              <div className="flex gap-3 mt-2">
                {unexcused > 0 && <span className="text-xs text-danger font-medium">{unexcused} unexcused</span>}
                {excused > 0 && <span className="text-xs text-warning font-medium">{excused} excused</span>}
                {late > 0 && <span className="text-xs text-warning font-medium">{late} late</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={cn(
                'text-3xl font-black',
                unexcused > 0 ? 'text-danger' : absenceCount > 0 ? 'text-warning' : 'text-success'
              )}>
                {absenceCount}
              </p>
              <p className="text-xs text-ink-muted">
                absence{absenceCount !== 1 ? 's' : ''}
              </p>
            </div>
          </motion.div>
        )}

        {/* Info banner */}
        {!loading && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-accent/5 border border-accent/20">
            <AlertCircle size={14} className="text-accent flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ink-secondary leading-relaxed">
              If you believe an absence is incorrect, please contact your FI or TA to have it reviewed.
            </p>
          </div>
        )}

        {/* Absence list */}
        <div className="flex flex-col gap-2">
          {absences.map((rec, i) => (
            <motion.div
              key={rec.sessionId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-bg-card border border-bg-border shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-ink-muted flex-shrink-0" />
                    <p className="text-sm font-semibold text-ink-primary">{formatDate(rec.date)}</p>
                  </div>

                  {rec.absenceReason && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <MapPin size={11} className="text-ink-muted flex-shrink-0" />
                      <p className="text-xs text-ink-secondary">
                        {absenceReasonLabel(rec.absenceReason)}
                      </p>
                    </div>
                  )}

                  {rec.submittedAt && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Clock size={11} className="text-ink-muted flex-shrink-0" />
                      <p className="text-xs text-ink-secondary">
                        Checked in at{' '}
                        <span className="font-mono text-ink-primary">
                          {new Date(rec.submittedAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {rec.startTime && (
                          <span className="text-ink-muted"> · class started {rec.startTime}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {rec.note && (
                    <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed italic">
                      "{rec.note}"
                    </p>
                  )}
                </div>
                <StatusBadge status={rec.status} size="md" />
              </div>
            </motion.div>
          ))}

          {!loading && absences.length === 0 && student && (
            <p className="text-sm text-ink-muted text-center py-10">
              No absences or late arrivals for this course.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
