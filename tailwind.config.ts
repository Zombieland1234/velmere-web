import type { Config } from "tailwindcss";

const opacityScale = Object.fromEntries(
  Array.from({ length: 101 }, (_, value) => [String(value), value === 100 ? "1" : String(value / 100)])
) as Record<string, string>;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "!./app/api/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      opacity: opacityScale,
      colors: {
        "velmere-black": "#080809",
        "velmere-graphite": "#0B0B0D",
        "velmere-charcoal": "#111113",
        "velmere-surface": "#111113",
        "velmere-panel": "#17181B",
        "velmere-elevated": "#1D1E22",
        "velmere-ivory": "#F5F0E8",
        "velmere-offwhite": "#FAF7F0",
        "velmere-grey-soft": "#D2CBC1",
        "velmere-muted": "#A79F95",
        "velmere-gold": "#C8A96A",
        "velmere-danger": "#B8695F",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "\"Times New Roman\"", "serif"],
        mono: ["var(--font-mono)", "\"JetBrains Mono\"", "monospace"],
      },
      transitionTimingFunction: {
        velmere: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        "velmere-card": "0 24px 90px rgba(0,0,0,0.28)",
        "velmere-glow": "0 0 0 1px rgba(200,169,106,0.16), 0 28px 90px rgba(0,0,0,0.34)",
      },
    },
  },
  plugins: [],
};
export default config;
