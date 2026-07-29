import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Covers pure logic only — anything importing a native module belongs in a
 * manual pass, not here. Today that means the reminder scheduling plan.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Pinned so date logic is asserted against a fixed offset. Without it a
    // UTC-vs-local bug is invisible on a machine that happens to run in UTC.
    env: { TZ: 'America/New_York' },
  },
});
