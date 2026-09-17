import { defineConfig } from 'vite'

// Server bundle: node:*, pg and PGlite stay external; app code (domain rules) is bundled in.
export default defineConfig({
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    target: 'node22',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: 'main.js' } },
  },
  ssr: { external: ['pg', '@electric-sql/pglite'] },
})
