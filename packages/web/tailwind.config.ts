import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Influence TV — magenta system (BET / HBO Max / Tubi inspired)
        itv: {
          bg: "#0d0d0d",
          surface: "#111111",
          surface2: "#161616",
          surface3: "#1a1a1a",
          border: "rgba(255,255,255,0.08)",
          border2: "rgba(255,255,255,0.05)",
          magenta: "#D946EF",
          "magenta-dim": "rgba(217,70,239,0.15)",
          "magenta-border": "rgba(217,70,239,0.25)",
          red: "#FF3333",
          "red-dim": "rgba(255,51,51,0.12)",
          white: "#FFFFFF",
          text: "#F0F0F0",
          muted: "rgba(255,255,255,0.42)",
          faint: "rgba(255,255,255,0.22)",
        },
        // Compatibility layer: existing routes use apex-* classes.
        // Remapped onto the new palette so untouched pages adopt the
        // redesign automatically (apex-red is now magenta, not #FF2D2D).
        apex: {
          black: "#0d0d0d",
          red: "#D946EF",
          white: "#F0F0F0",
          gray: {
            900: "#111111",
            800: "#161616",
            700: "#1a1a1a",
            600: "#222222",
            500: "#555555",
            400: "rgba(255,255,255,0.42)",
            300: "rgba(255,255,255,0.6)",
          },
        },
      },
      fontFamily: {
        sans: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        // display/body kept as aliases so existing font-display / font-body
        // classes keep resolving — now to the system stack (Syne removed).
        display: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        body: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
      borderColor: {
        apex: "rgba(255,255,255,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
