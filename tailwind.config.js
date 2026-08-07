/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
        },
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -4px rgb(15 23 42 / 0.08)',
        soft: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 4px 16px -2px rgb(15 23 42 / 0.05)',
        glow: '0 0 0 1px rgb(13 148 136 / 0.12), 0 8px 28px -6px rgb(13 148 136 / 0.28)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'panel-up': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'soft-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(13 148 136 / 0.35)' },
          '50%': { boxShadow: '0 0 0 10px rgb(13 148 136 / 0)' },
        },
        'msg-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.25s ease-out both',
        'panel-up': 'panel-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        'soft-pulse': 'soft-pulse 2.4s ease-out infinite',
        'msg-in': 'msg-in 0.3s ease-out both',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(ellipse 80% 50% at 10% -10%, rgb(45 212 191 / 0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 0%, rgb(56 189 248 / 0.12), transparent 50%), radial-gradient(ellipse 50% 30% at 50% 100%, rgb(20 184 166 / 0.08), transparent 45%)',
        'mesh-dark':
          'radial-gradient(ellipse 70% 45% at 5% -5%, rgb(20 184 166 / 0.14), transparent 50%), radial-gradient(ellipse 50% 35% at 95% 5%, rgb(14 165 233 / 0.1), transparent 45%)',
      },
    },
  },
  plugins: [],
};
