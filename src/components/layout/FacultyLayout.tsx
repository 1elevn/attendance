import { NavLink, useNavigate } from 'react-router-dom'
import { GraduationCap, LogOut, LayoutDashboard, BookOpen, Users, UserCog, RefreshCw, type LucideIcon } from 'lucide-react'
import { useAppStore } from '../../store'
import { Avatar } from '../ui/Avatar'
import { ThemeToggle } from '../ui/ThemeToggle'
import { motion } from 'framer-motion'

interface FacultyLayoutProps {
  children: React.ReactNode
}

interface NavItem {
  to: string
  label: string
  shortLabel: string
  icon: LucideIcon
}

export function FacultyLayout({ children }: FacultyLayoutProps) {
  const { userName, role, logout } = useAppStore()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/staff')
  }

  const navItems: NavItem[] = [
    { to: isAdmin ? '/admin/dashboard' : '/faculty/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { to: isAdmin ? '/admin/courses' : '/faculty/courses', label: 'Courses', shortLabel: 'Courses', icon: BookOpen },
    ...(isAdmin
      ? [
          { to: '/admin/students', label: 'Students', shortLabel: 'Students', icon: Users },
          { to: '/admin/faculty', label: 'Faculty', shortLabel: 'Faculty', icon: UserCog },
          { to: '/admin/camu', label: 'Camu Sync', shortLabel: 'Camu', icon: RefreshCw },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen flex flex-col dot-grid">
      {/* Simple top bar */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-bg-border bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-20 flex-shrink-0 pt-[env(safe-area-inset-top)] box-content">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <GraduationCap size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-ink-primary truncate">Ashesi Attendance</span>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <ThemeToggle />
          {userName && (
            <div className="flex items-center gap-2">
              <Avatar name={userName} size="sm" />
              <span className="text-xs text-ink-secondary hidden sm:block">{userName}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className="flex items-center justify-center gap-1.5 text-xs text-ink-muted hover:text-danger transition-colors min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 px-2 py-1.5 rounded-lg hover:bg-danger/10"
          >
            <LogOut size={16} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex-1 flex flex-col overflow-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0"
      >
        {children}
      </motion.main>

      {/* Mobile bottom tab bar (replaces the header nav below sm) */}
      <nav
        aria-label="Primary"
        className="sm:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-bg-border bg-bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      >
        {navItems.map(({ to, shortLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 min-w-0 h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                isActive ? 'text-accent' : 'text-ink-muted active:text-ink-secondary'
              }`
            }
          >
            <Icon size={18} />
            <span className="truncate max-w-full px-1">{shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
