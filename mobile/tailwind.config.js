/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // The platform palette, so the handhelds look like the web workspace.
        brand: {
          DEFAULT: '#14b8a6',
          dark: '#0f766e',
          deep: '#0b5f59',
          soft: '#e0f7f4',
          ink: '#0d766e',
        },
        navy: {
          DEFAULT: '#0f214a',
          soft: '#1e3a6b',
          deep: '#081533',
        },
        muted: '#64748b',
        faint: '#94a3b8',
        line: '#e2e8f0',
        canvas: '#f4f7fa',
        surface: '#ffffff',
        success: { DEFAULT: '#16a34a', soft: '#dcfce7' },
        warn: { DEFAULT: '#d97706', soft: '#fef3c7' },
        danger: { DEFAULT: '#dc2626', soft: '#fee2e2' },
        info: { DEFAULT: '#2563eb', soft: '#dbeafe' },
        violet: { DEFAULT: '#7c3aed', soft: '#ede9fe' },
      },
      borderRadius: {
        xl2: '18px',
        xl3: '26px',
        hero: '34px',
      },
    },
  },
  plugins: [],
}
