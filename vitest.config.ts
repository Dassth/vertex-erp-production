import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Unit tests only. The Playwright journey in e2e/ runs under its own runner
// (npx playwright test --config=e2e/playwright.config.ts).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
      // The embedded PostgreSQL engine (PGlite) crashes V8's optimising WebAssembly
      // compiler on this Node version; the baseline compiler runs it correctly.
      execArgv: ['--liftoff-only'],
    },
  }),
)
