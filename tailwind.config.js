/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
          hover: 'var(--color-surface-hover)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
        },
        critical: '#DC2626',
        'task-normal': '#2563EB',
        'task-milestone': '#7C3AED',
        'task-float': '#10B981',
        'task-baseline': '#6B7280',
        'task-complete': '#1D4ED8',
      },
    },
  },
  plugins: [],
};
