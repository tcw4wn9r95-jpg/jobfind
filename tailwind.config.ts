import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f6f7fb",
          100: "#eceef6",
          200: "#d9dcea",
          300: "#b3b9d1",
          400: "#8890ad",
          500: "#5f6787",
          600: "#454c68",
          700: "#333952",
          800: "#23283c",
          900: "#161a2b",
          950: "#0d101d"
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,26,43,0.06), 0 8px 24px -12px rgba(22,26,43,0.12)",
        lift: "0 2px 4px rgba(22,26,43,0.08), 0 16px 40px -16px rgba(99,102,241,0.35)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        rise: "rise 0.45s ease both",
        pulseSoft: "pulseSoft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
