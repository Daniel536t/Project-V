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
        ink: "#07070f",
        panel: "#12121f",
        "spider-red": "#ff2d55",
        "spider-pink": "#ff2ec4",
        "spider-blue": "#00d1ff",
        "spider-purple": "#9d4edd",
        "spider-yellow": "#ffe14d",
      },
      fontFamily: {
        display: ["Bangers", "cursive"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
