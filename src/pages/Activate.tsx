import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GraduationCap, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../store'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { usePageTitle } from '../hooks/usePageTitle'
import { validateActivationToken, activateAccount, ApiError } from '../lib/api'

type ValidationState = 'checking' | 'valid' | 'invalid'

export default function Activate() {
  usePageTitle('Set Up Your Account')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { setRole } = useAppStore()

  const [state, setState] = useState<ValidationState>('checking')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }
    validateActivationToken(token)
      .then((res) => {
        setName(res.name)
        setState('valid')
      })
      .catch(() => setState('invalid'))
  }, [token])

  const handleSubmit = async () => {
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const { token: accessToken, user } = await activateAccount(token, password)
      setRole(user.role, user.id, user.name, accessToken)
      toast.success(`Welcome, ${user.name.split(' ')[0]}`, { duration: 2000 })
      navigate(user.role === 'faculty' ? '/faculty/dashboard' : '/admin/dashboard')
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        toast.error('This link has expired.')
        setState('invalid')
      } else {
        toast.error('Could not set up your account — please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden dot-grid">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-64 bg-accent/[0.06] rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col gap-6">
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
            <p className="text-base font-bold text-ink-primary leading-none">Set Up Your Account</p>
            <p className="text-xs text-ink-muted mt-0.5">Ashesi University</p>
          </div>
        </motion.div>

        {state === 'checking' && (
          <div className="glass rounded-2xl p-5 text-center text-sm text-ink-muted">
            Checking your link…
          </div>
        )}

        {state === 'invalid' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
          >
            <XCircle size={28} className="text-danger" />
            <p className="text-sm font-medium text-ink-primary">This link has expired or is invalid</p>
            <p className="text-xs text-ink-muted">Ask your admin to send you a new invite, then try again.</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/staff')}>
              Back to sign in
            </Button>
          </motion.div>
        )}

        {state === 'valid' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5 flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 text-sm text-ink-secondary">
              <CheckCircle2 size={15} className="text-success flex-shrink-0" />
              Setting up account for <span className="font-semibold text-ink-primary">{name}</span>
            </div>
            <Input
              label="New password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <Input
              label="Confirm password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Button fullWidth size="lg" onClick={handleSubmit} loading={submitting}>
              Set password &amp; sign in
              <ArrowRight size={15} />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
