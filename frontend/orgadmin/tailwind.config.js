/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Distinct color scheme for orgadmin - using indigo/purple to differentiate from user frontend
        primary: {
          DEFAULT: '#8b5cf6', // Violet/purple accent
          hover: '#7c3aed',
        },
        secondary: {
          DEFAULT: '#312e81', // Dark indigo background
          hover: '#4338ca',
        },
        accent: {
          DEFAULT: '#06b6d4', // Cyan accent for highlights
          hover: '#0891b2',
        },
        'text-primary': '#1e1b4b',
        'text-secondary': '#64748b',
        background: '#f8fafc',
      }
    },
  },
  plugins: [],
}
