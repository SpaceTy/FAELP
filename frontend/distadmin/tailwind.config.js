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
        primary: 'rgb(var(--accent-primary) / <alpha-value>)',
        'primary-hover': 'rgb(var(--accent-primary-hover) / <alpha-value>)',
        secondary: '#1a365d',
        'secondary-hover': '#2d4a77',
        background: '#f0f2f5',
        'text-primary': '#1f2937',
        'text-secondary': '#4a5568',
        // Logistics aliases
        'logistics-header': '#1a365d',
        'logistics-accent': 'rgb(var(--accent-primary) / <alpha-value>)',
        'logistics-accent-hover': 'rgb(var(--accent-primary-hover) / <alpha-value>)',
        'logistics-secondary': '#2d4a77',
      }
    },
  },
  plugins: [],
}
