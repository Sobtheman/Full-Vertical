import { defineConfig } from 'vite';

// Two pages get built: the homepage, and the ribbon test page (not linked from the site).
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: 'index.html', ribbon: 'ribbon.html' },
    },
  },
});
