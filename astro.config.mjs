import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://blissdermacare.com',
  output: 'static',
  integrations: [
    tailwind()
  ],
  vite: {
    build: {
      // lightningcss (Vite 8 default) rejects some Tailwind CSS; esbuild handles it fine
      cssMinify: 'esbuild',
    },
  },
});
