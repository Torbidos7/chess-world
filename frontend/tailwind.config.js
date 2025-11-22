/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chess: {
          dark: '#2d3436',
          light: '#dfe6e9',
          boardDark: '#769656',
          boardLight: '#eeeed2',
          accent: '#0984e3',
        }
      }
    },
  },
  plugins: [],
}
