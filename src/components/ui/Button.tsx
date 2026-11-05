import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-base disabled:opacity-40 disabled:pointer-events-none select-none'

    const variants = {
      primary:
        'bg-accent text-white hover:bg-accent-light focus:ring-accent active:scale-[0.98]',
      secondary:
        'bg-bg-elevated text-ink-primary border border-bg-border hover:bg-bg-card focus:ring-accent/30 active:scale-[0.98]',
      ghost:
        'bg-transparent text-ink-secondary hover:text-ink-primary hover:bg-bg-elevated focus:ring-accent/30',
      danger:
        'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 focus:ring-danger/30 active:scale-[0.98]',
      success:
        'bg-success text-bg-base hover:opacity-90 focus:ring-success active:scale-[0.98]',
    }

    const sizes = {
      // 44px touch target on phones, compact on larger screens
      sm: 'text-xs px-3 py-1.5 h-11 sm:h-8',
      md: 'text-sm px-4 py-2 h-10',
      lg: 'text-base px-6 py-3 h-12',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
