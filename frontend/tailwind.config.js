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
          dark: "#0a0a0f",
          card: "#121218",
          accent: "#00f0ff",
          accent2: "#ff00aa",
        },
      },
    },
  },
  plugins: [],
};
