import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        leaf: "#4d7c0f",
        coral: "#c2410c",
        ocean: "#0369a1",
        sun: "#ca8a04",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(23, 32, 42, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
