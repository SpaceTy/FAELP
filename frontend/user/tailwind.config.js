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
        secondary: '#232f3e',
        'secondary-hover': '#37475a',
        background: '#f5f5f5',
        'text-primary': '#1f2937',
        'text-secondary': '#4a5568',
      }
    },
  },
  plugins: [],
}
