import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        monad: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#836EF9", // Primary Monad Purple
          600: "#6d4ff3",
          700: "#5b37e8",
          800: "#4826cc",
          900: "#381ea5",
          950: "#1a0b4e",
        },
        cyber: {
          dark: "#08060f",
          card: "rgba(18, 14, 34, 0.75)",
          border: "rgba(131, 110, 249, 0.2)",
          glow: "rgba(131, 110, 249, 0.4)",
          accent: "#00F2FE",
          neon: "#ff007a",
        }
      },
      fontFamily: {
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 25px rgba(131, 110, 249, 0.35)",
        "glow-lg": "0 0 50px rgba(131, 110, 249, 0.5)",
        cyan: "0 0 25px rgba(0, 242, 254, 0.35)",
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float-slow": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
