import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen, Users, ClipboardCheck, TrendingUp,
  ChevronRight,
} from 'lucide-react'
import { TopBar } from '../../components/layout/TopBar'
import { StatCard, Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { SessionStatusBadge } from '../../components/ui/Badge'
import { getMyCourses, getCourseSessions } from '../../lib/api'
import type { CourseWithSession } from '../../lib/api'
import type { Session, AttendanceRecord } from '../../types'
import { sortSessionsMostRecentFirst, sessionAttendanceRate, sessionPresentCount } from '../../lib/sessionUtils'
import { formatDate } from '../../lib/utils'
import { usePageTitle } from '../../hooks/usePageTitle'

export default function FacultyDashboard() {
  usePageTitle('Faculty Dashboard')
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [myCourses, setMyCourses] = useState<CourseWithSession[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, Session[]>>({})
  const [attendanceMap] = useState<Record<string, AttendanceRecord[]>>({})

  const loadDashboard = async () => {
    const courses = await getMyCourses()
    setMyCourses(courses)
    const byCourse = await Promise.all(
      courses.map(async (course) => ({
        courseId: course.id,
        sessions: await getCourseSessions(course.id),
      })),
    )
    setSessionMap(
      Object.fromEntries(byCourse.map((item) => [item.courseId, item.sessions])),
    )
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadDashboard()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    const interval = setInterval(() => {
      if (!cancelled) void loadDashboard().catch(() => {})
    }, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const mySessions = useMemo(
    () => Object.values(sessionMap).flat(),
    [sessionMap],
  )
  const liveSession = mySessions.find(s => s.status === 'open')
  const recentSessions = sortSessionsMostRecentFirst(
    mySessions.filter((s) => s.status === 'closed'),
  ).slice(0, 3)

  const totalStudents = myCourses.reduce((sum, c) => sum + c.enrolledCount, 0)
  const closedSessions = mySessions.filter(s => s.status === 'closed')

  const avgAttendance = closedSessions.length > 0
    ? Math.round(
        closedSessions.reduce((sum, s) => sum + sessionAttendanceRate(s), 0) /
        closedSessions.length
      )
    : 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      <TopBar
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <Button size="sm" onClick={() => navigate('/faculty/courses')}>
            Go to Courses
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Live session banner */}
        {liveSession && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl border border-success/30 bg-success/5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-success animate-ping opacity-60" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-primary">
                  Live session · {myCourses.find(c => c.id === liveSession.courseId)?.name}
                </p>
                <p className="text-xs text-ink-muted">
                  <code className="font-mono text-success">
                    {myCourses.find((c) => c.id === liveSession.courseId)?.cohortCode}
                  </code>
                  {' · '}{liveSession.submissionsCount}/{liveSession.totalStudents} submitted
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="success"
              onClick={() =>
                navigate(`/faculty/sessions/${liveSession.id}/live`, {
                  state: {
                    session: liveSession,
                    course: myCourses.find(c => c.id === liveSession.courseId) ?? null,
                  },
                })
              }
            >
              Monitor
              <ChevronRight size={14} />
            </Button>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'My Courses', value: myCourses.length, icon: <BookOpen size={16} />, accent: false },
            { label: 'Total Students', value: totalStudents, icon: <Users size={16} />, accent: false },
            { label: 'Sessions Run', value: closedSessions.length, icon: <ClipboardCheck size={16} />, accent: false },
            { label: 'Avg. Attendance', value: `${avgAttendance}%`, icon: <TrendingUp size={16} />, accent: true },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <StatCard {...s} sub={undefined} />
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Courses */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink-primary">My Courses</p>
              <Button variant="ghost" size="sm" onClick={() => navigate('/faculty/courses')}>
                View all <ChevronRight size={14} />
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {myCourses.map(course => {
                const upcoming = mySessions.find(s => s.courseId === course.id && s.status === 'upcoming')
                const live = mySessions.find(s => s.courseId === course.id && s.status === 'open')
                return (
                  <Card
                    key={course.id}
                    hover
                    padding="sm"
                    onClick={() => navigate(`/faculty/courses/${course.id}`)}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={15} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-ink-muted">{course.code}</p>
                      <p className="text-sm font-semibold text-ink-primary truncate">{course.name}</p>
                      <p className="text-xs text-ink-muted">{course.cohort} · {course.enrolledCount} students</p>
                    </div>
                    {live ? (
                      <SessionStatusBadge status="open" />
                    ) : upcoming ? (
                      <SessionStatusBadge status="upcoming" />
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </motion.div>

          {/* Recent sessions */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink-primary">Recent Sessions</p>
              <Button variant="ghost" size="sm" onClick={() => navigate('/faculty/courses')}>
                View all <ChevronRight size={14} />
              </Button>
            </div>
            {recentSessions.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-10 gap-2">
                <ClipboardCheck size={24} className="text-ink-muted" />
                <p className="text-sm text-ink-muted">No sessions run yet</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {recentSessions.map(session => {
                  const course = myCourses.find(c => c.id === session.courseId)
                  const rate = sessionAttendanceRate(session)
                  const present = sessionPresentCount(session)
                  const records = attendanceMap[session.id] ?? []
                  const excused = records.filter(r => r.status === 'absent_excused').length
                  const unexcused = records.filter(r => r.status === 'absent_unexcused').length

                  return (
                    <Card
                      key={session.id}
                      hover
                      padding="sm"
                      onClick={() =>
                        navigate(`/faculty/sessions/${session.id}/review`, {
                          state: {
                            session,
                            course: course ?? null,
                          },
                        })
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-ink-muted">
                            {course?.code} · {course?.cohort} · {formatDate(session.date)}
                          </p>
                          <p className="text-sm font-semibold text-ink-primary mt-0.5">{course?.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-success">{present} present</span>
                            {unexcused > 0 && <span className="text-xs text-danger">{unexcused} unexcused</span>}
                            {excused > 0 && <span className="text-xs text-warning">{excused} excused</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${rate >= 80 ? 'text-success' : rate >= 60 ? 'text-warning' : 'text-danger'}`}>
                            {rate}%
                          </p>
                          <p className="text-xs text-ink-muted">attendance</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
