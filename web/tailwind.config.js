/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#07080B', // Deep canvas
          900: '#0C0E14', // Workstation deck
          850: '#12151E', // Panel surface
          800: '#171B26', // Card container
          750: '#1F2433', // Hover/Active
          700: '#282F42', // Hairline borders
          600: '#3E4761',
          gold: '#F59E0B', // Precision studio amber
          'gold-hover': '#D97706',
          emerald: '#10B981',
          rose: '#EF4444',
          sky: '#0EA5E9',
        },
        studio: {
          900: '#0C0E14',
          800: '#12151E',
          700: '#171B26',
          600: '#282F42',
          gold: '#F59E0B',
          cyan: '#06B6D4',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
