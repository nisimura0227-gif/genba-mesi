import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2f7d4f",
          dark: "#1f5c3a",
          darker: "#153f28",
          light: "#eaf6ee",
          soft: "#dcf0e2",
        },
        accent: {
          DEFAULT: "#e67e22",
          dark: "#b85e18",
          light: "#fdf0e3",
          soft: "#fbe3c8",
        },
        canvas: "#f6f5f1",
        ink: "#20261f",
      },
      fontSize: {
        base: ["17px", "1.6"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 30, 20, 0.04), 0 8px 20px -6px rgba(20, 40, 25, 0.12)",
        "card-lg": "0 2px 4px rgba(20, 30, 20, 0.05), 0 16px 32px -8px rgba(20, 40, 25, 0.16)",
        pop: "0 2px 0 rgba(0, 0, 0, 0.12)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2f7d4f 0%, #1f5c3a 100%)",
        "accent-gradient": "linear-gradient(135deg, #f0954a 0%, #d96a15 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
