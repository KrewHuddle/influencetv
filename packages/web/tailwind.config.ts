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
        apex: {
          black: "#080808",
          red: "#FF2D2D",
          white: "#F4F4F4",
          gray: {
            900: "#111111",
            800: "#181818",
            700: "#222222",
            600: "#333333",
            500: "#555555",
            400: "#777777",
            300: "#AAAAAA",
          },
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderColor: {
        apex: "rgba(255,255,255,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
