/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#ff9900',
        'primary-hover': '#ffad33',
        secondary: '#232f3e',
        'secondary-hover': '#37475a',
        background: '#f5f5f5',
        'text-primary': '#333333',
        'text-secondary': '#666666',
      }
    },
  },
  plugins: [],
}
