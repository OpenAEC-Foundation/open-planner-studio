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
        // Functional colors via tokens — definitions in globals.css :root
        critical: 'var(--color-critical)',
        'task-normal': 'var(--color-task-normal)',
        'task-milestone': 'var(--color-task-milestone)',
        'task-float': 'var(--color-task-float)',
        'task-baseline': 'var(--color-task-baseline)',
        'task-complete': 'var(--color-task-complete)',
      },
    },
  },
  plugins: [],
};
