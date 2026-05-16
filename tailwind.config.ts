import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", ".theme-dark"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#050608",
          card: "#11151c",
          cardSoft: "#171c25",
          line: "#283241"
        },
        accent: {
          blue: "#38bdf8",
          blueDeep: "#0ea5e9"
        },
        signal: {
          danger: "#fb4d5f",
          warning: "#facc15",
          success: "#34d399"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56, 189, 248, 0.18), 0 18px 70px rgba(2, 8, 23, 0.55)"
      }
    }
  },
  plugins: []
};

export default config;
