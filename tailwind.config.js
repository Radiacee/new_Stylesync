/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      },
      colors: {
        brand: {
          50: '#f2f7ff',
          100: '#e0efff',
          200: '#b9ddff',
          300: '#82c2ff',
          400: '#45a3ff',
          500: '#187fff',
          600: '#0062e6',
          700: '#004cba',
          800: '#003f96',
          900: '#003376',
          950: '#012046'
        }
      },
      boxShadow: {
        'subtle-glow': '0 0 8px 2px rgba(24,127,255,0.35)',
        'glass': '0 4px 32px -8px rgba(0,0,0,0.35)'
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')
  ]
};
