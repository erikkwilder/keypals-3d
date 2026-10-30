/// <reference types="vitest/config" />
import { readFileSync, rmSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte(),
    // the dance check page's motion clips (public/devmotions, ~100 MB) are for development only
    { name: 'drop-dev-files', apply: 'build', closeBundle() { rmSync(new URL('./dist/devmotions', import.meta.url), { recursive: true, force: true }); } },
    // the game's styles load after the loading screen in index.html, so that screen paints while they come
    // down (the game's code still waits for them, so nothing shows unstyled)
    {
      name: 'loading-screen-first', apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html: string) {
          const links = html.match(/<link rel="stylesheet"[^>]*>/g) ?? [];
          for (const l of links) html = html.replace(l, '');
          // (at the very end of the page: the start-up check's script above it isn't held up by them either)
          return html.replace('</body>', `${links.join('\n')}\n</body>`);
        },
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version) },
  clearScreen: false,
  base: './',
  // the save API lives on fancyant.com: the dev and test servers pass /api through to it (save codes work; sign-in needs the real site)
  server: { port: 5192, strictPort: true, host: '127.0.0.1', proxy: { '/api': { target: 'https://fancyant.com', changeOrigin: true, rewrite: (p) => '/keypals' + p } } },
  preview: { port: 8799, strictPort: true, host: '127.0.0.1', allowedHosts: ['shmergles-mac-mini.tail88c58e.ts.net'], proxy: { '/api': { target: 'https://fancyant.com', changeOrigin: true, rewrite: (p) => '/keypals' + p } } },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { include: ['src/**/*.test.ts', 'deploy/site/**/*.test.js'], environment: 'node' },
});
