/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: '#C75B3F',
        cream: '#F5E6D3',
        sage: '#87A878',
        charcoal: '#121212',
      },
    },
  },
  plugins: [],
};
