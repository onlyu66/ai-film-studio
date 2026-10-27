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
          canvas: '#0E1015',
          deck: '#141720',
          card: '#1A1E29',
          border: '#232838',
          'border-hover': '#32394E',
          amber: '#F59E0B',
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
