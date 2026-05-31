import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        sora: ["var(--font-display)", "sans-serif"],
      },
      borderRadius: {
        sm: "0.5rem",       // 8px
        DEFAULT: "1rem",   // 16px
        md: "1.5rem",      // 24px
        lg: "2rem",        // 32px
        xl: "3rem",        // 48px
        full: "9999px",
      },
      colors: {
        // Maintain alias for compatibility, mapped to Deep Emerald
        forest: "#003527",
        ocean: "#31694b",
        sand: "#eceef0",
        
        // Fluid Institutional Palette
        brand: {
          surface: '#f7f9fb',
          'surface-dim': '#d8dadc',
          'surface-bright': '#f7f9fb',
          'surface-container-lowest': '#ffffff',
          'surface-container-low': '#f2f4f6',
          'surface-container': '#eceef0',
          'surface-container-high': '#e6e8ea',
          'surface-container-highest': '#e0e3e5',
          'on-surface': '#191c1e',
          'on-surface-variant': '#404944',
          'inverse-surface': '#2d3133',
          'inverse-on-surface': '#eff1f3',
          outline: '#707974',
          'outline-variant': '#bfc9c3',
          'surface-tint': '#2b6954',
          primary: '#003527',
          'on-primary': '#ffffff',
          'primary-container': '#064e3b',
          'on-primary-container': '#80bea6',
          'inverse-primary': '#95d3ba',
          secondary: '#31694b',
          'on-secondary': '#ffffff',
          'secondary-container': '#b4f0c9',
          'on-secondary-container': '#386f50',
          tertiary: '#2d2f2f',
          'on-tertiary': '#ffffff',
          'tertiary-container': '#434545',
          'on-tertiary-container': '#b1b2b2',
          error: '#ba1a1a',
          'on-error': '#ffffff',
          'error-container': '#ffdad6',
          'on-error-container': '#93000a',
          'primary-fixed': '#b0f0d6',
          'primary-fixed-dim': '#95d3ba',
          'on-primary-fixed': '#002117',
          'on-primary-fixed-variant': '#0b513d',
          'secondary-fixed': '#b4f0c9',
          'secondary-fixed-dim': '#99d4ae',
          'on-secondary-fixed': '#002111',
          'on-secondary-fixed-variant': '#175034',
          'tertiary-fixed': '#e2e2e2',
          'tertiary-fixed-dim': '#c6c6c7',
          'on-tertiary-fixed': '#1a1c1c',
          'on-tertiary-fixed-variant': '#454747',
          background: '#f7f9fb',
          'on-background': '#191c1e',
          'surface-variant': '#e0e3e5',
        }
      },
    },
  },
  plugins: [],
};

export default config;
