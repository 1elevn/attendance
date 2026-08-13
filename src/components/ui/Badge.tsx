import { cn, statusColors, statusLabel } from '../../lib/utils'
import type { AttendanceStatus } from '../../types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

export function Badge({ children, variant = 'default', size = 'sm', dot, className }: BadgeProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-full border'

  const variants = {
    default: 'text-ink-secondary bg-ink-primary/5 border-ink-primary/10',
    success: 'text-success bg-success/10 border-success/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    danger: 'text-danger bg-danger/10 border-danger/20',
    info: 'text-accent bg-accent/10 border-accent/20',
    muted: 'text-ink-muted bg-transparent border-transparent',
  }

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }

  return (
    <span className={cn(base, variants[variant], sizes[size], className)}>
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', {
            'bg-success': variant === 'success',
            'bg-warning': variant === 'warning',
            'bg-danger': variant === 'danger',
            'bg-accent': variant === 'info',
            'bg-ink-muted': variant === 'default' || variant === 'muted',
          })}
        />
      )}
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: AttendanceStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-full border'
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' }

  return (
    <span className={cn(base, statusColors(status), sizes[size])}>
      <span
        className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', {
          'bg-success': status === 'recorded',
          'bg-warning': status === 'late' || status === 'absent_excused',
          'bg-danger': status === 'absent_unexcused',
          'bg-ink-muted': status === 'pending',
        })}
      />
      {statusLabel(status)}
    </span>
  )
}

interface SessionStatusBadgeProps {
  status: 'upcoming' | 'open' | 'processing' | 'closed'
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const config = {
    upcoming: { label: 'Upcoming', variant: 'muted' as const, pulse: false },
    open: { label: 'Live', variant: 'success' as const, pulse: true },
    processing: { label: 'Processing', variant: 'warning' as const, pulse: true },
    closed: { label: 'Closed', variant: 'default' as const, pulse: false },
  }
  const c = config[status]

  return (
    <Badge variant={c.variant} dot>
      {c.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            status === 'open' ? 'bg-success' : 'bg-warning'
          )} />
        </span>
      )}
      {c.label}
    </Badge>
  )
}
