/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Dusty Rose/Blush palette - industry standard for luxury skincare
        // Inspired by Glossier, Heyday, and high-end esthetician brands
        primary: {
          50: '#fdf5f6',
          100: '#fceaec',
          200: '#f9d5db',
          300: '#f4b4be',
          400: '#ec8a99',
          500: '#df6377',
          600: '#c94d63',  // Main brand color - elegant dusty rose
          700: '#a93d51',
          800: '#8d3645',
          900: '#78323e',
        },
        // Warm neutral palette for text and backgrounds
        neutral: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
      },
      fontFamily: {
        serif: ['Cormorant', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cormorant', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
