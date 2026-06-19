/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bay: {
          dark: "#000000",
          card: "#111111",
          accent: "#22ffaa",
          accent2: "#22ffaa",
          bright: "#33ffbb",
          gray: "#888888",
        },
      },
    },
  },
  plugins: [],
};
