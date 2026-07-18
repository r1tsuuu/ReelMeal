/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ReelMeal brand palette — kept in sync with src/styles/theme.css's
        // :root custom properties (that file is Tailwind v4 syntax and isn't
        // wired in directly; this project stays on v3).
        cream: '#f8f4ec',
        'cream-deep': '#f1ead9',
        charcoal: '#3c3a37',
        terracotta: '#d9714e',
        'terracotta-dark': '#c15f3e',
        sage: '#6f8a5f',
        'sage-deep': '#5c7451',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
