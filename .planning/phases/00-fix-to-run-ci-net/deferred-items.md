# Deferred Items — Phase 00 (fix-to-run-ci-net)

Out-of-scope discoveries found during execution. NOT fixed here (deviation SCOPE BOUNDARY).

## From Plan 00-01

- ✅ **RESOLVED (2026-08-18)** — Duplicate `vite` dependency in `package.json` (`vite` was in both
  `dependencies` and `devDependencies`). Removed from `dependencies` (kept in `devDependencies`,
  where a build tool belongs); `bun.lock` re-synced. Fixed as post-phase cleanup after the user
  requested small hardening before pushing to CI.
