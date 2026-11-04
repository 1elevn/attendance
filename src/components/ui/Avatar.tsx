import { cn } from '../../lib/utils'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getColor(name: string): string {
  const colors = [
    'bg-accent/15 text-accent',
    'bg-success/15 text-success',
    'bg-warning/15 text-warning',
    'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
    'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-12 w-12 text-base',
  }

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
      sizes[size],
      getColor(name),
      className
    )}>
      {getInitials(name)}
    </div>
  )
}
