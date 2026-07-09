import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, BookOpen, ShieldCheck, ChevronLeft, ArrowRight } from 'lucide-react'
import { useAppStore } from '../store'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { usePageTitle } from '../hooks/usePageTitle'
import { login, ApiError } from '../lib/api'
import toast from 'react-hot-toast'

type Role = 'faculty' | 'admin'

const DEMO_CREDS: Record<Role, { email: string; password: string }> = {
  faculty: { email: 'r.ekumah@ashesi.edu.gh', password: 'demo123' },
  admin: { email: 'admin@ashesi.edu.gh', password: 'demo123' },
}

export default function StaffLogin() {
  usePageTitle('Staff Login')
  const navigate = useNavigate()
  const { setRole } = useAppStore()

  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    if (!selectedRole) return
    setLoading(true)
    try {
      const { token, user } = await login(identifier.trim(), password)
      setRole(user.role, user.id, user.name, token)
      const first = user.name.split(' ')[0]
      toast.success(`Welcome, ${first}`, { duration: 2000 })
      if (user.role === 'faculty') navigate('/faculty/dashboard')
      else navigate('/admin/dashboard')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error('Invalid credentials.')
      } else {
        toast.error('Login failed — please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden dot-grid">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-64 bg-accent/[0.06] rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col gap-6">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-secondary transition-colors w-fit"
        >
          <ChevronLeft size={14} />
          Back
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-ink-primary leading-none">Staff Login</p>
            <p className="text-xs text-ink-muted mt-0.5">Ashesi University</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {!selectedRole ? (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              <p className="text-xs text-ink-muted">Select your role to continue</p>
              {([
                {
                  key: 'faculty' as Role,
                  label: 'Faculty Intern',
                  desc: 'Manage sessions and track attendance',
                  icon: BookOpen,
                  colors: 'border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 text-accent',
                },
                {
                  key: 'admin' as Role,
                  label: 'Administrator',
                  desc: 'View reports and export data',
                  icon: ShieldCheck,
                  colors: 'border-warning/30 bg-warning/5 hover:bg-warning/10 hover:border-warning/50 text-warning',
                },
              ]).map(r => {
                const Icon = r.icon
                return (
                  <button
                    key={r.key}
                    onClick={() => setSelectedRole(r.key)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 ${r.colors}`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center flex-shrink-0">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-ink-primary text-sm">{r.label}</p>
                      <p className="text-xs text-ink-secondary mt-0.5">{r.desc}</p>
                    </div>
                  </button>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="glass rounded-2xl p-5 flex flex-col gap-4"
            >
              <button
                onClick={() => { setSelectedRole(null); setIdentifier(''); setPassword('') }}
                className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-secondary transition-colors w-fit"
              >
                <ChevronLeft size={13} />
                {selectedRole === 'faculty' ? 'Faculty Intern' : 'Administrator'}
              </button>

              <Input
                label="Email"
                type="email"
                placeholder={import.meta.env.PROD ? 'you@ashesi.edu.gh' : DEMO_CREDS[selectedRole].email}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoFocus
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignIn()}
              />
              {!import.meta.env.PROD && (
                <p className="text-xs text-ink-muted -mt-1">
                  Demo: <code className="text-accent font-mono">{DEMO_CREDS[selectedRole]?.email}</code>
                  {' · '}
                  <code className="text-accent font-mono">password123</code>
                </p>
              )}
              <Button fullWidth size="lg" onClick={handleSignIn} loading={loading}>
                Sign In
                <ArrowRight size={15} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
