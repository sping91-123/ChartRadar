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
          base: "#090d12",
          card: "#10151c",
          cardSoft: "#141a22",
          line: "#2b3440"
        },
        ui: {
          canvas: "var(--cr-color-canvas)",
          panel: "var(--cr-color-panel)",
          elevated: "var(--cr-color-elevated)",
          inset: "var(--cr-color-inset)",
          line: "var(--cr-color-line)",
          lineStrong: "var(--cr-color-line-strong)",
          text: "var(--cr-color-text)",
          muted: "var(--cr-color-muted)",
          subtle: "var(--cr-color-subtle)",
          active: "var(--cr-color-active)",
          activeText: "var(--cr-color-active-text)",
          brand: "var(--cr-color-brand)",
          long: "var(--cr-color-long)",
          short: "var(--cr-color-short)",
          risk: "var(--cr-color-risk)",
          watch: "var(--cr-color-watch)",
          locked: "var(--cr-color-locked)"
        },
        accent: {
          blue: "#60a5fa",
          blueDeep: "#2563eb"
        },
        signal: {
          danger: "#f43f5e",
          warning: "#d97706",
          success: "#22c55e"
        }
      },
      borderRadius: {
        ui: "var(--cr-radius)",
        "ui-sm": "var(--cr-radius-sm)",
        "ui-lg": "var(--cr-radius-lg)"
      },
      boxShadow: {
        glow: "none",
        "ui-panel": "var(--cr-shadow-panel)",
        "ui-elevated": "var(--cr-shadow-elevated)"
      },
      fontSize: {
        "ui-label": ["0.6875rem", { lineHeight: "1rem" }],
        "ui-body": ["0.875rem", { lineHeight: "1.375rem" }],
        "ui-title": ["1rem", { lineHeight: "1.4rem" }],
        "ui-heading": ["1.25rem", { lineHeight: "1.75rem" }]
      }
    }
  },
  plugins: []
};

export default config;
