# Testing Patterns

**Analysis Date:** 2026-08-17

## Test Framework

**Runner:**
- None. No test runner is installed or configured.
- No Vitest, Jest, Playwright, Cypress, or Testing Library in `package.json`.
- No `vitest.config.*` or `jest.config.*` present.

**Assertion Library:**
- None.

**Run Commands:**
```bash
# No test command exists. package.json defines no "test" script.
# The only quality gate is type checking:
bun run lint        # runs `tsc --noEmit`
```

## Test File Organization

**Location:**
- Not applicable — no `*.test.*` or `*.spec.*` files exist anywhere in the repo.

**Naming:**
- No established convention yet. Recommended when introduced: co-locate as `<Component>.test.tsx` next to source.

**Structure:**
```
No test directories or files present.
```

## Test Structure

**Suite Organization:**
- None established.

**Patterns:**
- None established.

## Mocking

**Framework:** None.

**Patterns:**
- No mocking in place.

**What to Mock (recommendation when tests are added):**
- The `/api/generate` `fetch` call in `src/store/useStore.ts` (mock `global.fetch`).
- The Gemini SDK `GoogleGenAI` client in `server.ts` (mock `ai.models.generateContent`).
- `navigator.clipboard.writeText` used by `handleCopy` in `src/components/ResultDisplay.tsx`.

**What NOT to Mock:**
- Zustand store logic — exercise the real store to verify state transitions.
- `react-hook-form` validation — test real form behavior.

## Fixtures and Factories

**Test Data:**
- None. When added, build fixtures against the `GeneratedContent` shape in `src/types.ts` (mirrors the Gemini JSON schema in `server.ts`).

**Location:**
- Not established.

## Coverage

**Requirements:** None enforced. No coverage tooling configured.

**View Coverage:**
```bash
# Not available.
```

## Test Types

**Unit Tests:**
- None. High-value first targets: the Zustand `generateContent` action (success, HTTP error, network error paths in `src/store/useStore.ts`) and the `cn()` utility.

**Integration Tests:**
- None. The Express `/api/generate` handler in `server.ts` is the natural integration target (validation branches, missing API key, JSON parse failure, Gemini error).

**E2E Tests:**
- Not used.

## Common Patterns

**Async Testing:**
- No pattern established. The primary async surfaces are the store's `generateContent` (fetch) and the server route handler (Gemini call).

**Error Testing:**
- No pattern established. Notable untested error branches:
  - `server.ts`: missing `productInfo`/`affiliateLink` (400), missing `GEMINI_API_KEY` (500), empty Gemini response (throws), malformed JSON from `JSON.parse(text)`.
  - `src/store/useStore.ts`: non-OK response handling and network failure fallback message.

## Manual Verification (current practice)

- Type safety via `tsc --noEmit` (`bun run lint`).
- Manual browser testing via `bun run dev` (tsx + Vite middleware on port 3000).
- No automated verification exists — this is a significant gap; see CONCERNS.

---

*Testing analysis: 2026-08-17*
