import { NavLink, useNavigate } from 'react-router-dom'
import { GraduationCap, LogOut } from 'lucide-react'
import { useAppStore } from '../../store'
import { Avatar } from '../ui/Avatar'
import { motion } from 'framer-motion'

interface FacultyLayoutProps {
  children: React.ReactNode
}

export function FacultyLayout({ children }: FacultyLayoutProps) {
  const { userName, role, logout } = useAppStore()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/staff')
  }

  return (
    <div className="min-h-screen flex flex-col dot-grid">
      {/* Simple top bar */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-bg-border bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <GraduationCap size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-ink-primary">Ashesi Attendance</span>
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink
              to={isAdmin ? '/admin/dashboard' : '/faculty/dashboard'}
              className={({ isActive }) =>
                `text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  isActive ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to={isAdmin ? '/admin/courses' : '/faculty/courses'}
              className={({ isActive }) =>
                `text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  isActive ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated'
                }`
              }
            >
              Courses
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {userName && (
            <div className="flex items-center gap-2">
              <Avatar name={userName} size="sm" />
              <span className="text-xs text-ink-secondary hidden sm:block">{userName}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-danger transition-colors px-2 py-1.5 rounded-lg hover:bg-danger/10"
          >
            <LogOut size={14} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex-1 flex flex-col overflow-auto"
      >
        {children}
      </motion.main>

    </div>
  )
}
