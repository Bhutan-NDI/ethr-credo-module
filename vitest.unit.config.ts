import { defineConfig } from 'vitest/config'

// No askar setup, so these run in CI without install scripts.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
