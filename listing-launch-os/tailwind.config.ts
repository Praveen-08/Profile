import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: "#FAFAF8",
        charcoal: "#2B2B2B",
        gold: {
          DEFAULT: "#B8944F",
          light: "#D8BE86",
          dark: "#8F6E36",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["-apple-system", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: {
        premium: "0 4px 24px rgba(17, 17, 17, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
