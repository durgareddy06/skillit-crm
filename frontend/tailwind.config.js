/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        skillit: {
          DEFAULT: "#007FC5",
          dark: "#007FC5",
          light: "#007FC5",
          bg: "#f4f6fb",
          sidebar: "#111827",
        },
      },
      fontFamily: {
        display: ["'Be Vietnam Pro'", "sans-serif"],
        data: ["'Poppins'", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(15, 23, 42, 0.06)",
        pop: "0 8px 24px rgba(59, 110, 165, 0.25)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: 0, transform: "translateX(-8px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
        popIn: {
          "0%": { opacity: 0, transform: "scale(0.95)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.25s ease-out",
        slideIn: "slideIn 0.2s ease-out",
        popIn: "popIn 0.18s ease-out",
      },
    },
  },
  plugins: [],
};
