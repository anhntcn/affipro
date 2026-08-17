---
phase: 00-fix-to-run-ci-net
reviewed: 2026-08-17T09:46:53Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - server.ts
  - server/config.ts
  - src/schema/generatedContent.ts
  - src/schema/modelAllowlist.ts
  - src/components/ErrorBoundary.tsx
  - src/components/ResultDisplay.tsx
  - src/App.tsx
  - scripts/check-model-allowlist.mjs
  - .github/workflows/ci.yml
  - vitest.config.ts
  - tests/api.generate.test.ts
  - tests/config.test.ts
  - tests/ResultDisplay.test.tsx
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 00: Code Review Report

**Reviewed:** 2026-08-17T09:46:53Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 00 hardened the Gemini generate seam (finishReason-first gate, guarded parse, Zod double-guard, single bounded retry, leak-free Vietnamese errors), added fail-fast boot env validation, null-guarded the render path, and locked everything behind a static, secret-free CI net. The failure-taxonomy structure is sound, the client never receives internals, and CI carries no `GEMINI_API_KEY`. The finishReason-before-`.text` ordering, the exactly-one-retry policy, and the import-time-safe `loadEnv()` all check out.

However there is one BLOCKER: the model allowlist contains `gemini-3.7-flash`, the exact id CLAUDE.md flags as invalid — the allowlist is supposed to be the guardrail that makes an invalid model unpinnable, and it currently sanctions the very id it should reject. Several WARNINGs concern the retry classifier's incomplete deterministic-block set (real Gemini finishReasons like `BLOCKLIST`/`PROHIBITED_CONTENT`/`SPII` get wrongly retried), an unsound `finish as FailReason` cast, and boot-config edge cases (`PORT` coerces to `NaN` silently, `NODE_ENV` enum kills boot on any unlisted value). The render null-guards cover array `.map()`/`.join()` well but leave top-level channel objects unguarded.

## Critical Issues

### CR-01: Invalid model id `gemini-3.7-flash` present in the CI allowlist

**File:** `src/schema/modelAllowlist.ts:20`
**Issue:** `ALLOWLIST` contains `'gemini-3.7-flash'`. The project CLAUDE.md constraint states explicitly: "Ưu tiên model Gemini mới nhất còn hiệu lực (thay `gemini-3.7-flash` không hợp lệ)" — `gemini-3.7-flash` is a known-invalid id and was the original bug this phase set out to fix. The allowlist's entire purpose (per its own header comment and `scripts/check-model-allowlist.mjs`) is to guarantee "the deployed model id can only ever be one of the verified-valid ids." Including an invalid id defeats that guarantee: a future editor could set `MODEL_ID = 'gemini-3.7-flash'` and both the runtime invariant (line 27) and the CI static check would pass, shipping a model that returns HTTP 404 on every `/api/generate` call. The file also claims all six ids were "verified against the Google Gemini deprecations documentation on 2026-08-17," which is contradicted by the project's own constraint.
**Fix:**
```ts
/** Verified-valid Gemini model ids (verified 2026-08-17). */
export const ALLOWLIST = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  // 'gemini-3.7-flash' removed — CLAUDE.md flags this id as invalid.
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
] as const;
```
Re-verify every remaining id against ai.google.dev/gemini-api/docs/deprecations before merging; do not trust the existing in-file claim.

## Warnings

### WR-01: Deterministic Gemini content blocks are misclassified as retryable

**File:** `server.ts:100,164`
**Issue:** `HARD_FAIL_FINISH` contains only `"SAFETY"` and `"RECITATION"`. The Gemini API returns several other deterministic block reasons — `BLOCKLIST`, `PROHIBITED_CONTENT`, `SPII`, and `IMAGE_SAFETY` — none of which are transient. On any of these, line 164 computes `retryable: !HARD_FAIL_FINISH.has(finish)` → `true`, so the handler fires a second identical paid round-trip that fails the same way. The phase spec requires deterministic reasons to never retry. This is a correctness + cost bug on real block responses (the test suite only exercises `SAFETY`, so it passes while the gap ships).
**Fix:**
```ts
const HARD_FAIL_FINISH = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);
```
Consider inverting the policy to an allowlist of retryable reasons (`MAX_TOKENS`, `OTHER`) so any unknown/new finishReason defaults to non-retryable rather than retryable.

### WR-02: Unsound `finish as FailReason` cast admits unmodeled finishReasons

**File:** `server.ts:163`
**Issue:** `const reason = finish as FailReason;` blindly casts the raw SDK string into the `FailReason` union. `FailReason` only models `SAFETY|RECITATION|SCHEMA|MAX_TOKENS|OTHER|EMPTY|PARSE`, but `finishReason` can be `BLOCKLIST`, `PROHIBITED_CONTENT`, `MALFORMED_FUNCTION_CALL`, `LANGUAGE`, etc. The cast makes those values flow through as if they were valid union members. `vietnameseErrorFor` happens to catch them via its `default` branch (so no client leak), but the retry classification (WR-01) is silently wrong, and the type system is lying — a future refactor that trusts `reason: FailReason` (e.g. a `switch` without `default`) would mishandle these.
**Fix:** Normalize unknown reasons into the modeled set before returning:
```ts
const known: FailReason[] = ["SAFETY","RECITATION","MAX_TOKENS"];
const reason: FailReason = (known as string[]).includes(finish)
  ? (finish as FailReason)
  : "OTHER";
return { ok: false, reason, retryable: !HARD_FAIL_FINISH.has(finish) };
```

### WR-03: Invalid `PORT` coerces to `NaN` and silently binds a random port

**File:** `server/config.ts:13`
**Issue:** `PORT: z.coerce.number().default(3000)`. `z.coerce.number()` on a non-numeric string (e.g. `PORT="abc"` or `PORT="8080 "` with stray chars) produces `NaN`, and `z.number()` accepts `NaN` (it is `typeof "number"`). `loadEnv()` therefore returns `PORT: NaN`, and `app.listen(NaN, ...)` makes Node bind an arbitrary OS-assigned port instead of failing fast. This contradicts the phase's fail-fast-at-boot intent — a misconfigured `PORT` should die at boot, not start on an unpredictable port.
**Fix:**
```ts
PORT: z.coerce.number().int().positive().max(65535).default(3000),
```
`.int().positive()` rejects `NaN` and out-of-range values, forcing the fail-fast path in `loadEnv()`.

### WR-04: `NODE_ENV` enum kills boot on any value outside three literals

**File:** `server/config.ts:14`
**Issue:** `NODE_ENV: z.enum(["development","production","test"])`. Deploy platforms and CI runners frequently set `NODE_ENV` to other values (`staging`, `ci`, `qa`, or an empty/whitespace string). Any such value makes `loadEnv()` `process.exit(1)` at boot with a "Missing or invalid environment variables" message — a hard, surprising boot failure for an otherwise-valid deploy. The only value that actually drives behavior is the `!== "production"` check at `server.ts:306`, so a strict tri-state enum is over-constrained.
**Fix:** Relax to a defaulted string, or make non-production values collapse safely:
```ts
NODE_ENV: z.string().default("development"),
```
Keep the `production` special-case in `server.ts`; treat everything else as non-production.

### WR-05: Top-level channel objects are unguarded in ResultDisplay

**File:** `src/components/ResultDisplay.tsx:95-99,119-120,143-148,192-193`
**Issue:** The phase added `?? []` guards on every array access, but the tab components dereference the top-level channel objects directly: `AnalysisTab` reads `data.product_name` (line 99), `FacebookTab` reads `data.hook_headline` (line 120/125), `VideoTab` reads `data.video_title` (line 148). If a malformed payload omits an entire channel (`product_analysis`, `facebook_threads`, or `short_video_script` is `undefined`), `data` is `undefined` and these dereferences throw `TypeError: Cannot read properties of undefined`. The `ResultDisplay.test.tsx` fixture keeps all four top-level objects present, so this gap is untested. The ErrorBoundary does catch the throw (so no white-screen), but "guarded so a missing-field payload cannot crash render" is only half-met — the server Zod double-guard is the real backstop, yet the phase brief asks the render path itself to be crash-proof.
**Fix:** Default each channel object at the call site in `ResultDisplay`:
```tsx
{activeTab === 'analysis' && <AnalysisTab data={generatedContent.product_analysis ?? {}} />}
{activeTab === 'facebook' && <FacebookTab data={generatedContent.facebook_threads ?? {}} onCopy={handleCopy} copied={copiedStates['fb']} />}
{activeTab === 'video' && <VideoTab data={generatedContent.short_video_script ?? {}} .../>}
```
Or add optional chaining (`data?.product_name`) inside each tab. Add a test fixture that omits a whole channel object.

### WR-06: Empty-string `productInfo`/`affiliateLink` bypass no real validation

**File:** `server.ts:192-196`
**Issue:** The guard `if (!productInfo || !affiliateLink)` rejects missing/empty values, which is correct, but there is no type or content validation: a caller can send `{ productInfo: 12345, affiliateLink: {...} }` or a multi-megabyte string (up to the 32kb body cap) and it is interpolated straight into the prompt. `affiliateLink` is not validated as a URL, so non-URL text is embedded and returned as a "call to action" link. For an endpoint whose whole job is prompt construction from user input, at minimum enforce string type and a length bound; validate `affiliateLink` shape.
**Fix:**
```ts
if (typeof productInfo !== "string" || typeof affiliateLink !== "string" ||
    !productInfo.trim() || !affiliateLink.trim()) {
  return res.status(400).json({ error: "Missing or invalid productInfo or affiliateLink" });
}
```
Optionally validate `affiliateLink` with `z.string().url()` and cap `productInfo.length`.

## Info

### IN-01: `server.ts` reads `process.env.NODE_ENV` directly instead of validated `env.NODE_ENV`

**File:** `server.ts:306`
**Issue:** `startServer()` validates env via `loadEnv()` into `env` but then branches on `process.env.NODE_ENV !== "production"` (line 306) rather than `env.NODE_ENV`. Harmless today, but it bypasses the single validated source of truth and would diverge if the schema ever normalizes `NODE_ENV`.
**Fix:** Use `env.NODE_ENV !== "production"`.

### IN-02: Retry log line omits the second-attempt outcome

**File:** `server.ts:262-266,275`
**Issue:** On a retried failure, two `console.error` lines are emitted (the "retrying once" line and the "failed after retry policy" line), but the retry-trigger log names only the first reason. When first and second reasons differ (e.g. `PARSE` then `EMPTY`), operators see `reason=PARSE` on retry and `reason=EMPTY` on final, which is slightly confusing to correlate. Minor observability nit; no security impact (no key/prompt logged — verified).
**Fix:** Include attempt number in both log lines, e.g. `attempt=1 reason=...` / `attempt=2 reason=...`.

### IN-03: `handleCopy` ignores `navigator.clipboard.writeText` rejection

**File:** `src/components/ResultDisplay.tsx:24-30`
**Issue:** `navigator.clipboard.writeText(text)` returns a Promise that can reject (permissions, insecure context). The result is unhandled, so a copy failure still flips the UI to the "copied" checkmark, silently misleading the user. Out of this phase's stated scope but worth noting.
**Fix:** `navigator.clipboard.writeText(text).then(() => setCopiedStates(...)).catch(() => {/* keep icon unchanged */});`

---

_Reviewed: 2026-08-17T09:46:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
