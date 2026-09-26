import { defineConfig } from 'vite'

// Windows offline package: one self-contained server file (pg and adm-zip bundled in),
// so the installed copy needs no node_modules. PGlite is not used offline.
export default defineConfig({
  build: {
    ssr: 'server/desktop.ts',
    outDir: 'release/stage/app',
    target: 'node22',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: false,
    rollupOptions: { output: { entryFileNames: 'main.js', format: 'es' }, external: ['pg-native'] },
  },
  ssr: { noExternal: true },
})
