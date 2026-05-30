import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forest: "#0f5132",
        ocean: "#0f6b83",
        sand: "#f7f3e8",
      },
    },
  },
  plugins: [],
};

export default config;
