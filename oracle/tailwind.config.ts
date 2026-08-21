import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // SENSE — Miles Morales palette
        "sense-black": "#000000",
        "sense-dark": "#0a0a0a",
        "sense-tertiary": "#16161c",
        "sense-text": "#eaeaea",
        "sense-muted": "#a0a0a0",
        "sense-dim": "#5c5c66",
        "sense-electric": "#00d4ff",
        "sense-purple": "#6b00ff",
        "sense-success": "#00ff88",
        "sense-danger": "#ff2d55",
        "sense-warning": "#ffaa00",
      },
      fontFamily: {
        display: ["Bangers", "cursive"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
