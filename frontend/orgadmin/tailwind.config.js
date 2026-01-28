/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4ade80',
          hover: '#22c55e',
        },
        secondary: '#1e293b',
        'text-primary': '#334155',
        'text-secondary': '#64748b',
      }
    },
  },
  plugins: [],
}
