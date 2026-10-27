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
        studio: {
          canvas: '#0E1015',      // Soft, warm charcoal canvas (not harsh pitch black)
          deck: '#141720',        // Elevated studio panel deck
          card: '#1A1E29',        // Rich card surface
          elevated: '#212634',    // Hover & elevated chips
          input: '#101219',       // Sunken input background
          border: '#232838',      // Soft harmonic tonal border (no white wireframe!)
          'border-hover': '#32394E',
          'border-focus': '#454E6B',
          text: '#E2E8F0',        // Restful pearl white text
          muted: '#8B95A5',       // Gentle slate muted text
          amber: '#F59E0B',       // Warm golden cinema amber
          'amber-soft': '#FBBF24',
          'amber-muted': 'rgba(245, 158, 11, 0.12)',
        },
        cinema: {
          canvas: '#08090D',
          deck: '#0E1118',
          surface: '#0F121C',
          card: '#141824',
          'card-hover': '#1B2030',
          border: '#1F2538',
          'border-hover': '#2D354F',
          amber: '#F59E0B',
          gold: '#FBBF24',
          ruby: '#E11D48',
          cyan: '#06B6D4',
          emerald: '#10B981',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'studio-sm': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'studio-md': '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
        'studio-lg': '0 8px 30px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.25)',
        'studio-xl': '0 12px 40px rgba(0,0,0,0.6)',
      }
    },
  },
  plugins: [],
}
