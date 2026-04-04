// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hatarakuinsight.com',
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    sitemap({
      changefreq: 'daily',
      priority: 0.7,
      lastmod: new Date(),
    })
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
