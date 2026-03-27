import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        garden: {
          50: "#f7fdf4",
          100: "#e8fbde",
          200: "#d2f6c3",
          300: "#b0ec9d",
          400: "#87de6e",
          500: "#59c744",
          600: "#42a835",
          700: "#33832c",
          800: "#2b6828",
          900: "#235622",
        },
      },
    },
  },
  plugins: [],
};

export default config;
