import { useState, useEffect } from 'react'
import { Info, Clock, AlertTriangle, ChevronDown } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { createSession, updateSession, ApiError, getApiErrorMessage } from '../../lib/api'
import type { CourseWithSession } from '../../lib/api'
import type { Session } from '../../types'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  defaultCourseId?: string
  courseData?: CourseWithSession
  session?: Session | null
  onCreated?: (session: Session) => void
  onUpdated?: (session: Session) => void
}

const MIN_SAMPLES_DISCLAIMER = `min_samples controls how many GPS points DBSCAN requires to form a "cluster" (group of students physically present together).

Setting it too LOW: Even a small cluster of students colluding off-campus could be marked as present.

Setting it too HIGH: Legitimate students who are physically present may not form a large enough cluster, and be marked absent.

The recommended value is 10. Only change this if you have a specific reason — for example, a very small class. Consult your department if unsure.`

const EARLY_OPEN_MINUTES = 5

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function defaultStartTime(schedule: string): string {
  const match = schedule.match(/(\d{2}:\d{2})/)
  return match ? match[1] : '08:00'
}

function windowDurationFromSession(session: Session): number {
  const [sh, sm] = session.startTime.split(':').map(Number)
  const [ch, cm] = session.windowCloseTime.split(':').map(Number)
  return (ch * 60 + cm) - (sh * 60 + sm)
}

export default function CreateSessionModal({
  open,
  onClose,
  defaultCourseId,
  courseData,
  session,
  onCreated,
  onUpdated,
}: Props) {
  const isEdit = !!session
  const selectedCourse = courseData

  const [sessionDate, setSessionDate] = useState(todayISO())
  const [classStartTime, setClassStartTime] = useState(() =>
    selectedCourse ? defaultStartTime(selectedCourse.schedule) : '08:00',
  )
  const [windowDuration, setWindowDuration] = useState('5')
  const [minSamples, setMinSamples] = useState('10')
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (session) {
      setSessionDate(session.date)
      setClassStartTime(session.startTime)
      setWindowDuration(String(windowDurationFromSession(session)))
      setMinSamples(String(session.minSamples))
      setShowAdvanced(session.minSamples !== 10)
    } else {
      setSessionDate(todayISO())
      setClassStartTime(selectedCourse ? defaultStartTime(selectedCourse.schedule) : '08:00')
      setWindowDuration('5')
      setMinSamples('10')
      setShowAdvanced(false)
    }
    setShowDisclaimer(false)
    // Only seed when the modal opens or a different session is selected —
    // not when parent polling refreshes course/session object references.
  }, [open, session?.id])

  const windowOpen = addMinutes(classStartTime, -EARLY_OPEN_MINUTES)
  const windowClose = addMinutes(classStartTime, parseInt(windowDuration) || 5)

  const handleMinSamplesChange = (val: string) => {
    const n = parseInt(val)
    if (!isNaN(n) && n !== 10) setShowDisclaimer(true)
    setMinSamples(val)
  }

  const handleSubmit = async () => {
    const payload = {
      date: sessionDate,
      startTime: classStartTime,
      windowDuration: parseInt(windowDuration) || 5,
      minSamples: parseInt(minSamples) || 10,
      epsilon: session?.epsilon ?? 150,
    }

    setLoading(true)
    try {
      if (isEdit && session) {
        const updated = await updateSession(session.id, payload)
        toast.success('Session updated')
        onClose()
        onUpdated?.(updated)
      } else {
        if (!defaultCourseId) return
        const created = await createSession(defaultCourseId, payload)
        toast.success('Session created')
        onClose()
        onCreated?.(created)
      }
    } catch (err) {
      if (err instanceof ApiError && (err.body?.error as string) === 'session_already_open') {
        toast.error('A session for this course is already open.')
      } else if (err instanceof ApiError && (err.body?.error as string) === 'session_not_editable') {
        toast.error('This session can no longer be edited.')
      } else if (err instanceof ApiError) {
        toast.error(getApiErrorMessage(err))
      } else {
        toast.error(isEdit ? 'Failed to update session. Please try again.' : 'Failed to create session. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Modal
        open={open && !showDisclaimer}
        onClose={onClose}
        title={isEdit ? 'Edit Session' : 'Create Session'}
        description={
          isEdit
            ? 'Update the date, time, or settings for this upcoming session'
            : 'Students submit attendance using the course code and their student ID'
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={loading}
              disabled={!isEdit && !defaultCourseId}
            >
              {isEdit ? 'Save Changes' : 'Create Session'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          {selectedCourse && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-surface border border-bg-border">
              <Info size={13} className="text-ink-muted flex-shrink-0" />
              <p className="text-xs text-ink-muted">
                {selectedCourse.cohort} · {selectedCourse.enrolledCount} students enrolled
              </p>
            </div>
          )}

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
            />
            <Input
              label="Class starts"
              type="time"
              value={classStartTime}
              onChange={e => setClassStartTime(e.target.value)}
              // hint={selectedCourse ? `Schedule: ${selectedCourse.schedule.split('·')[1]?.trim() || ''}` : undefined}
            />
          </div>

          <Input
            label="Window duration (minutes)"
            type="number"
            min="1"
            max="30"
            value={windowDuration}
            onChange={e => setWindowDuration(e.target.value)}
            hint="How long students have to submit once class starts"
          />

          {/* Summary */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/5 border border-accent/15">
            <Clock size={14} className="text-accent flex-shrink-0" />
            <p className="text-xs text-accent">
              Window opens at <strong>{windowOpen}</strong> ({EARLY_OPEN_MINUTES} min before class) and closes at <strong>{windowClose}</strong>
            </p>
          </div>

          {/* Advanced */}
          <div className="border-t border-bg-border pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(p => !p)}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-secondary transition-colors"
            >
              <ChevronDown size={13} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              Advanced settings
              {parseInt(minSamples) !== 10 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[10px] font-medium">modified</span>
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-ink-secondary">DBSCAN min_samples</label>
                  <button onClick={() => setShowDisclaimer(true)} className="text-xs text-accent hover:underline">
                    What is this?
                  </button>
                </div>
                <Input
                  type="number"
                  min="2"
                  max="50"
                  value={minSamples}
                  onChange={e => handleMinSamplesChange(e.target.value)}
                  hint={parseInt(minSamples) !== 10 ? 'Changed from recommended default (10)' : 'Recommended: 10'}
                />
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* min_samples disclaimer */}
      <Modal
        open={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        title="About min_samples"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setMinSamples('10'); setShowDisclaimer(false) }}>
              Reset to 10 (recommended)
            </Button>
            <Button size="sm" onClick={() => setShowDisclaimer(false)}>
              I understand, keep my value
            </Button>
          </>
        }
      >
        <div className="py-2 flex flex-col gap-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20">
            <AlertTriangle size={15} className="text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning leading-relaxed">
              Changing this value affects how DBSCAN determines who is physically present. Read carefully before proceeding.
            </p>
          </div>
          <Card className="bg-bg-surface">
            <p className="text-xs text-ink-secondary leading-relaxed whitespace-pre-line">{MIN_SAMPLES_DISCLAIMER}</p>
          </Card>
          <p className="text-xs text-ink-muted">Current value: <code className="font-mono text-accent">{minSamples}</code> (default is 10)</p>
        </div>
      </Modal>
    </>
  )
}
