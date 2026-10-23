/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version) },
  clearScreen: false,
  base: './',
  server: { port: 5192, strictPort: true, host: '127.0.0.1' },
  preview: { port: 8799, strictPort: true, host: '127.0.0.1', allowedHosts: ['shmergles-mac-mini.tail88c58e.ts.net'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
