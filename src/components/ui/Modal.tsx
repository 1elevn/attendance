import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, description, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full glass-elevated rounded-t-2xl sm:rounded-2xl z-10 flex flex-col',
              'max-h-[90dvh] sm:max-h-[calc(100dvh-2rem)]',
              sizes[size]
            )}
          >
            <div className="flex items-start justify-between p-4 sm:p-6 pb-4 flex-shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
                {description && (
                  <p className="text-sm text-ink-secondary mt-1">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-4 -mt-1 -mr-1 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 sm:px-6 pb-2 overflow-y-auto flex-1 min-h-0">{children}</div>

            {footer && (
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-4 sm:p-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6 border-t border-bg-border flex-shrink-0 [&>button]:w-full sm:[&>button]:w-auto">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, loading,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-secondary pb-2">{message}</div>
    </Modal>
  )
}
