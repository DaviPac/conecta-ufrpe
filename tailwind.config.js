/** @type {import('tailwindcss').Config} */
export default {
  // Esta é a parte que corrige o aviso:
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Diz ao Tailwind para ler seus componentes React
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}