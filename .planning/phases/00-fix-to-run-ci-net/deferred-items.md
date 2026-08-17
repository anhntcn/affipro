# Deferred Items — Phase 00 (fix-to-run-ci-net)

Out-of-scope discoveries found during execution. NOT fixed here (deviation SCOPE BOUNDARY).

## From Plan 00-01

- **Pre-existing duplicate `vite` dependency in `package.json`** — `vite` is listed in both
  `dependencies` (line ~27) and `devDependencies` (line ~43). Present before this plan; `bun add`
  surfaces a "Duplicate dependency" warning on every install. Out of scope for 00-01 (does not
  affect the testable-seam/happy-path deliverables). Candidate cleanup for the FIX-05
  metadata/cleanup work (Plan 00-02/00-04, which already touches `package.json`).
