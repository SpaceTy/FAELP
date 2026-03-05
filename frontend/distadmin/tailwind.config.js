/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#48bb78',
        'primary-hover': '#38a169',
        secondary: '#1a365d',
        'secondary-hover': '#2d4a77',
        background: '#f0f2f5',
        'text-primary': '#1f2937',
        'text-secondary': '#4a5568',
        // Logistics aliases
        'logistics-header': '#1a365d',
        'logistics-accent': '#48bb78',
        'logistics-accent-hover': '#38a169',
        'logistics-secondary': '#2d4a77',
      }
    },
  },
  plugins: [],
}
