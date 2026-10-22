/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pro: {
          gold: "#D4AF37",
          dark: "#121722",
          card: "#1E222D",
          border: "#2A2E39",
          muted: "#787B86",
          green: "#089981",
          red: "#F23645",
          blue: "#2962FF"
        }
      }
    },
  },
  plugins: [],
}
