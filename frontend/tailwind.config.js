/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        cb: {
          50: "#f3e6ff",
          100: "#e8d0ff",
          500: "#9673a6",
          600: "#7c5a8c",
          700: "#6c3d99",
        },
        mfo: {
          50: "#e6f4f1",
          100: "#c0e8de",
          500: "#1d9e75",
          600: "#178a63",
          700: "#1d6b4e",
        },
        mer: {
          50: "#e6f1fb",
          100: "#c0d9f5",
          500: "#6c8ebf",
          600: "#4a70a8",
          700: "#185fa5",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05)",
        "card-hover": "0 4px 20px rgba(0,0,0,.12)",
        glow: "0 0 20px rgba(99,102,241,.35)",
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        sm: "0.5rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
    },
  },
  plugins: [],
};
