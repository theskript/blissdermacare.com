/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff4ed',
          100: '#ffe6d5',
          200: '#feccaa',
          300: '#fdab74',
          400: '#fb7e3c',
          500: '#f95c16',
          600: '#ea450c',
          700: '#c2330c',
          800: '#9a2b12',
          900: '#7c2712',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter Display', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
