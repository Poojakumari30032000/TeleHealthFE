/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  darkMode: 'class',
  content: [
    './src/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mulish: 'var(--font-family)',
      },
      colors: {
        primary: {
          DEFAULT: 'var(--primary-color)',
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        secondP: {
          DEFAULT: 'var(--secondP-color)'
        },
        danger: {
          DEFAULT : '#ef4444',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d'
        },
        gray: {
          50: 'rgb(249 250 251)',
          100: 'rgb(243 244 246)',
          200: 'rgb(229 231 235)',
          300: 'rgb(209 213 219)',
          400: 'rgb(156 163 175)',
          500: 'rgb(107 114 128)',
          600: 'rgb(75 85 99)',
          700: 'rgb(55 65 81)',
          800: 'rgb(31 41 55)',
          900: 'rgb(17 24 39)',
        },
        white: '#fff',
        lightPrimary: 'var(--primary-50)'
      },
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px'
      }
    },
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true,
  },
  // experimental: {
  //   optimizeUniversalDefaults: true
  // }
}
