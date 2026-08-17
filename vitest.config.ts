import { defineConfig } from 'vitest/config';

// Single global node environment. Do NOT use environmentMatchGlobs — it was
// REMOVED in Vitest 4 (pinned ^4.1.10); relying on it would silently leave the
// setting unset. React render tests (Plan 00-03) opt into jsdom per-file via the
// Vitest 4 docblock `// @vitest-environment jsdom` on their first line — the
// supported per-file override. This config leaves the global environment at node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
