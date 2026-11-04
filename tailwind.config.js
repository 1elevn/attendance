// Semantic colors are CSS variables (see src/index.css) so the light/dark themes
// swap by toggling the `dark` class on <html>. Variables hold space-separated RGB
// channels so opacity modifiers like `bg-accent/10` keep working.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          base: v('bg-base'),
          surface: v('bg-surface'),
          card: v('bg-card'),
          elevated: v('bg-elevated'),
          border: v('bg-border'),
        },
        accent: {
          DEFAULT: v('accent'),
          light: v('accent-light'),
          dim: 'var(--c-accent-dim)',
        },
        success: {
          DEFAULT: v('success'),
          dim: 'var(--c-success-dim)',
        },
        warning: {
          DEFAULT: v('warning'),
          dim: 'var(--c-warning-dim)',
        },
        danger: {
          DEFAULT: v('danger'),
          dim: 'var(--c-danger-dim)',
        },
        ink: {
          primary: v('ink-primary'),
          secondary: v('ink-secondary'),
          muted: v('ink-muted'),
          faint: v('ink-faint'),
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}
