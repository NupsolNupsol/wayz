/** @type {import('tailwindcss').Config} */
const withOpacity = (v) => `rgb(var(${v}) / <alpha-value>)`

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: withOpacity('--brand'),
          hover: withOpacity('--brand-600'),
          mid: withOpacity('--brand-600'),
          700: withOpacity('--brand-700'),
          fg: withOpacity('--brand-fg'),
        },
        secondary: withOpacity('--secondary'),
        switchc: withOpacity('--switch'),
        accent: withOpacity('--brand'),
        accent2: withOpacity('--brand-600'),
        success: withOpacity('--success'),
        warning: withOpacity('--warning'),
        danger: { DEFAULT: withOpacity('--danger'), strong: withOpacity('--danger') },
        muted: withOpacity('--muted'),
        lightblue: withOpacity('--muted'),
        line: withOpacity('--line'),
        surface: withOpacity('--surface'),
        canvas: withOpacity('--canvas'),
        navy: {
          DEFAULT: withOpacity('--ink'),
          50: withOpacity('--brand-50'),
          600: withOpacity('--brand-600'),
          700: withOpacity('--brand-700'),
          800: withOpacity('--ink'),
          900: withOpacity('--ink-900'),
        },
        dk: {
          bg: withOpacity('--dk-bg'),
          surface: withOpacity('--dk-surface'),
          elevated: withOpacity('--dk-elevated'),
          border: withOpacity('--dk-border'),
          muted: withOpacity('--dk-muted'),
          text: withOpacity('--dk-text'),
          textdim: withOpacity('--dk-textdim'),
          texthi: withOpacity('--dk-texthi'),
        },
      },
      fontFamily: {
        sans: ['var(--font)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { xl2: '14px', card: '16px', pill: '28px', sidebar: '32px' },
      boxShadow: {
        card: '0 1px 3px rgb(var(--shadow) / 0.06), 0 1px 2px rgb(var(--shadow) / 0.04)',
        cardhover: '0 4px 24px rgb(var(--shadow) / 0.10)',
        sidebar: '0 4px 24px rgb(var(--shadow) / 0.18)',
        pop: '0 8px 24px rgb(var(--shadow) / 0.12)',
      },
      spacing: { sidebar: '282px', 'sidebar-collapsed': '80px', header: '80px' },
    },
  },
  plugins: [],
}
