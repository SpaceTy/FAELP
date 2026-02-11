/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Logistics Theme Colors
        primary: '#ff9900',
        'primary-hover': '#ffad33',
        secondary: '#232f3e',
        'secondary-hover': '#37475a',
        background: '#f0f2f5',
        'text-primary': '#333333',
        'text-secondary': '#666666',
        // Logistics-specific colors
        'logistics-header': '#1a365d',
        'logistics-accent': '#48bb78',
        'logistics-accent-hover': '#38a169',
        'logistics-secondary': '#2d4a77',
      }
    },
  },
  plugins: [],
}
