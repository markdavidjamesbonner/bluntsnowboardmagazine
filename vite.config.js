import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

import { serveLocalFiles } from './vite_plugins/serveLocalFiles.js';

const FLIPBOOK_DIRECTORY = fileURLToPath(new URL('./flipbook_pages', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    serveLocalFiles({
      directory: FLIPBOOK_DIRECTORY,
      routePrefix: '/flipbook/',
      contentTypes: { '.webp': 'image/webp' },
    }),
  ],
  server: {
    watch: { ignored: ['**/blunt_magazine_complete_1_22/**', '**/flipbook_pages/**'] },
  },
});
