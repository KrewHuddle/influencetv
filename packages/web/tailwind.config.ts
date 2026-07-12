import type { Config } from "tailwindcss";

/* Lemon Signal — creator-network dark. Colours reference the OKLCH token
 * source of truth in globals.css :root. Alpha-tint variants stay explicit so
 * existing classes keep resolving. */
const config: Config = {
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        itv: {
          bg: "var(--itv-bg)",
          surface: "var(--itv-surface)",
          surface2: "var(--itv-surface2)",
          surface3: "var(--itv-surface3)",
          border: "var(--itv-border)",
          border2: "var(--itv-border2)",
          // signature accents
          accent: "var(--itv-accent)",
          "accent-strong": "var(--itv-accent-strong)",
          "accent-dim": "rgba(240,225,60,0.13)",
          "accent-border": "rgba(240,225,60,0.3)",
          gold: "var(--itv-gold)",
          "gold-dim": "rgba(233,150,70,0.14)",
          "gold-border": "rgba(233,150,70,0.3)",
          live: "var(--itv-live)",
          "live-dim": "rgba(255,77,94,0.14)",
          success: "var(--itv-success)",
          "success-dim": "rgba(52,211,153,0.15)",
          warn: "var(--itv-warn)",
          "warn-dim": "rgba(233,150,70,0.15)",
          hover: "var(--itv-hover)",
          scrim: "var(--itv-scrim)",
          text: "var(--itv-text)",
          muted: "var(--itv-muted)",
          faint: "var(--itv-faint)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Bricolage Grotesque", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      // Named stacking ladder — don't improvise z values.
      zIndex: {
        header: "40",
        overlay: "50",
        drawer: "60",
        toast: "100",
      },
      boxShadow: {
        "glow-accent": "0 0 0 1px rgba(240,225,60,0.35), 0 8px 40px -12px rgba(240,225,60,0.45)",
        "glow-gold": "0 0 0 1px rgba(233,150,70,0.35), 0 8px 40px -14px rgba(233,150,70,0.5)",
        "glow-live": "0 0 0 1px rgba(255,77,94,0.4), 0 6px 30px -10px rgba(255,77,94,0.55)",
        card: "0 2px 8px -2px rgba(0,0,0,0.5), 0 12px 40px -18px rgba(0,0,0,0.7)",
      },
      transitionTimingFunction: {
        "ease-out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
        "ease-in-out-soft": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      keyframes: {
        "live-pulse": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.4s cubic-bezier(0.65,0,0.35,1) infinite",
        rise: "rise 360ms cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
