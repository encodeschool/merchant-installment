/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cb: {
          50: '#f3e6ff', 100: '#e8d0ff', 500: '#9673a6', 600: '#7c5a8c', 700: '#6c3d99',
        },
        mfo: {
          50: '#e6f4f1', 100: '#c0e8de', 500: '#1d9e75', 600: '#178a63', 700: '#1d6b4e',
        },
        mer: {
          50: '#e6f1fb', 100: '#c0d9f5', 500: '#6c8ebf', 600: '#4a70a8', 700: '#185fa5',
        },
      },
    },
  },
  plugins: [],
}
