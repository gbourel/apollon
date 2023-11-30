/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: 'nsix.test',
    port: 2901
  },
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'terser'
  }
})
