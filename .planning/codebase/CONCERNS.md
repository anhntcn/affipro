# Codebase Concerns

**Analysis Date:** 2026-08-17

This is a small Vite + React 19 + Express single-endpoint app ("Affiliate Content Pro") that proxies a prompt to the Gemini API and renders the JSON result across tabs. The concerns below are prioritized for an early-stage app that is close to, but not ready for, production exposure.

## Tech Debt

**Leftover Google AI Studio template scaffolding:**
- Issue: The project was generated from a Google AI Studio template and retains generic/placeholder metadata that misrepresents the app.
- Files:
  - `index.html` — `<title>My Google AI Studio App</title>`, description/OG/Twitter meta all say "An application built with Google AI Studio." (lines 6-11)
  - `metadata.json` — empty `name` and `description` fields (lines 2-3)
  - `README.md` — titled "Run and deploy your AI Studio app", links to an `ai.studio/apps/...` URL and a `.env.local` file that does not exist (lines 5-18)
  - `package.json` — `"name": "react-example"` (line 2)
- Impact: Poor SEO/social preview, confusing onboarding, README instructions reference a nonexistent file.
- Fix approach: Set real app name/description in `index.html`, `metadata.json`, `package.json`; rewrite `README.md` for the actual project and correct env setup instructions.

**No response schema / type enforcement on Gemini output:**
- Issue: `server.ts` requests `responseMimeType: "application/json"` but supplies no `responseSchema`. The model is only instructed via prose in the prompt to follow the JSON shape.
- Files: `server.ts` (lines 84-97)
- Impact: The model can return malformed JSON or a JSON object with missing/renamed keys. Downstream the UI trusts the shape completely (see Known Bugs).
- Fix approach: Pass a `responseSchema` to `generateContent` matching `GeneratedContent` in `src/types.ts`, and/or validate the parsed object (e.g. Zod) before returning it to the client.

**Corrupted comment encoding in vite.config.ts:**
- Issue: A comment contains a mojibake character: "Do not modifyâfile watching..." (an em-dash mis-encoded).
- Files: `vite.config.ts` (line 16)
- Impact: Cosmetic only, but a signal the file may have been saved with mixed encodings.
- Fix approach: Re-save as UTF-8, fix the character.

**`clean` script is POSIX-only:**
- Issue: `"clean": "rm -rf dist server.js"` will not run on a stock Windows shell (the dev environment here is Windows).
- Files: `package.json` (line 11)
- Impact: `npm run clean` fails on Windows/PowerShell.
- Fix approach: Use `rimraf` or a cross-platform script.

## Known Bugs

**Invalid Gemini model id — endpoint will fail at runtime:**
- Symptoms: Every call to `POST /api/generate` throws; the client shows the generic Vietnamese error toast. No content can ever be generated.
- Files: `server.ts` (line 85)
- Trigger: Any generate request. The model is set to `"gemini-3.7-flash"`, which is not a valid Gemini model id. Valid ids follow the `gemini-2.x-flash` / `gemini-2.x-pro` family.
- Workaround: Replace with a real, currently-available model id (e.g. a `gemini-2.5-flash`-class id verified against the `@google/genai` v2.4 docs) before use.

**`JSON.parse` with no guard on model output:**
- Symptoms: If Gemini returns anything that is not strictly valid JSON (extra prose, markdown code fences, truncated output), `JSON.parse(text)` throws and the whole request 500s.
- Files: `server.ts` (line 97)
- Trigger: Model returns non-JSON or wrapped JSON. Not deterministic — depends on model behavior.
- Workaround: Wrap parse in try/catch with a clear error, strip code fences, or enforce a schema (see Tech Debt).

**UI `.map()` and nested field access with no null-guarding:**
- Symptoms: If the parsed response is missing a key or an array field, the corresponding tab throws a render error (white screen / React error), because there is no error boundary.
- Files: `src/components/ResultDisplay.tsx`
  - `data.key_benefits.map(...)` (line 108)
  - `data.product_highlights.map(...)` (line 130) and `.join('\n')` in `contentString` (line 120)
  - `data.hashtags.join(' ')` (lines 120, 136)
  - `data.scenes.map(...)` (line 157)
- Trigger: A model response that omits or renames any of these fields (very possible without schema enforcement — see above).
- Workaround: Add optional chaining / default arrays (`(data.scenes ?? []).map`), validate the payload server-side, and add a React error boundary around `ResultDisplay`.

## Security Considerations

**No rate limiting on `/api/generate`:**
- Risk: The endpoint calls a paid Gemini API on every request with no throttling, auth, or abuse protection. A public deployment invites cost-drain / DoS by repeated calls.
- Files: `server.ts` (lines 17, 121 — server binds `0.0.0.0`)
- Current mitigation: None.
- Recommendations: Add rate limiting (e.g. `express-rate-limit`) per IP, consider request-size limits on `express.json()`, and add basic auth or a shared secret if the app is not meant to be public.

**Server binds to all interfaces:**
- Risk: `app.listen(PORT, "0.0.0.0", ...)` exposes the dev/prod server on every network interface. Combined with no rate limiting, the Gemini-backed endpoint is reachable by anyone on the network.
- Files: `server.ts` (line 121)
- Current mitigation: None.
- Recommendations: Bind to `127.0.0.1` for local dev, or ensure a properly firewalled/reverse-proxied deployment with the mitigations above.

**Unbounded prompt injection surface / no input length limits:**
- Risk: `productInfo` and `affiliateLink` are interpolated directly into the LLM prompt with no length cap or sanitization. Large inputs inflate token cost; crafted inputs can steer the model's output.
- Files: `server.ts` (lines 19-23, 32-82)
- Current mitigation: Only presence checks (`if (!productInfo || !affiliateLink)`); client validates URL format but server does not.
- Recommendations: Enforce max lengths server-side, validate `affiliateLink` as a URL server-side, and treat model output as untrusted.

**No secret is committed, but handling is fragile:**
- Risk: `GEMINI_API_KEY` is read from `process.env` (`server.ts` line 25). `.gitignore` correctly excludes `.env*` except `.env.example`, so no key is committed. `metadata.json` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, so the key stays server-side (good — not exposed to the browser).
- Files: `server.ts` (line 25), `.gitignore` (lines 7-8)
- Current mitigation: Key is server-side and gitignored.
- Recommendations: Keep it this way; document the required `.env` file (README currently points to a nonexistent `.env.local`).

## Performance Bottlenecks

**Single synchronous LLM round-trip per request, no caching:**
- Problem: Each generate request makes one blocking Gemini call; identical inputs re-generate from scratch.
- Files: `server.ts` (lines 84-90), `src/store/useStore.ts` (lines 16-33)
- Cause: No caching layer or dedup.
- Improvement path: Cache by input hash if repeated inputs are expected; otherwise acceptable for current scope. Add a client-side request timeout and abort handling.

**No streaming; long generations block the UI spinner:**
- Problem: The full JSON is awaited before anything renders; long generations leave the user on an indeterminate spinner.
- Files: `src/store/useStore.ts` (lines 16-37), `src/components/InputForm.tsx` (lines 85-95)
- Cause: `generateContent` waits for the complete response.
- Improvement path: Acceptable at this scale; consider streaming or a progress indicator with timeout if latency grows.

## Fragile Areas

**`server.ts` request handler — the entire app hinges on it:**
- Files: `server.ts` (lines 17-104)
- Why fragile: Combines model id, prompt, JSON parsing, and error handling with no schema and no tests. Any of the bugs above breaks the whole product. The model id bug (line 85) means it is currently broken by default.
- Safe modification: Introduce schema validation and a typed parse boundary before changing prompt or model; add an integration test that mocks the Gemini client.
- Test coverage: None.

**`ResultDisplay.tsx` rendering — trusts server payload shape entirely:**
- Files: `src/components/ResultDisplay.tsx` (lines 75-197)
- Why fragile: Deeply accesses nested fields and maps arrays with no defensive checks and no error boundary. A single missing field crashes the render.
- Safe modification: Add defaulting/optional chaining and an error boundary before extending tabs.
- Test coverage: None.

## Scaling Limits

**Hardcoded `PORT = 3000`:**
- Current capacity: Single fixed port.
- Limit: Cannot be configured per environment; conflicts with other services on 3000; breaks platforms that inject a `$PORT`.
- Scaling path: Read `const PORT = Number(process.env.PORT) || 3000;` in `server.ts` (line 12).

**Stateless single-process server, no horizontal-scale concerns yet:**
- Current capacity: Fine for low traffic.
- Limit: Cost and rate limits are the real ceiling (see Security).
- Scaling path: Add rate limiting and cost controls before scaling exposure.

## Dependencies at Risk

**`@google/genai` `^2.4.0` — API surface tied to the broken model id:**
- Risk: The invalid model id (`gemini-3.7-flash`) suggests the model/version pairing was never verified against this SDK version.
- Impact: Runtime failure on every request.
- Migration plan: Verify a valid model id against the installed `@google/genai` v2.4 docs and pin it; add a smoke test.

**`express` `^4.21.2`:**
- Risk: Express 4 is stable but v5 is current; no immediate risk. Caret ranges across all deps mean `npm install` can pull newer minors than the `bun.lock` snapshot if the lockfile is bypassed.
- Impact: Low, but reproducibility depends on committing/using the lockfile consistently (project has `bun.lock`, no `package-lock.json`).
- Migration plan: Standardize on one package manager + lockfile; document it in README.

## Missing Critical Features

**No configuration for port, host, or model:**
- Problem: Port, bind host, and Gemini model are all hardcoded in `server.ts`.
- Blocks: Environment-specific deployment and easy model swaps.

**No `.env.local` referenced by README actually exists:**
- Problem: README step 2 tells users to set the key in `.env.local`, which is not present; only `.env.example` exists.
- Blocks: First-run setup for new developers.

**No error boundary in the React app:**
- Problem: A single bad render (see fragile areas) crashes the UI with no recovery.
- Blocks: Graceful degradation when the model returns unexpected shapes.

## Test Coverage Gaps

**Zero automated tests in the repository:**
- What's not tested: Everything — the `/api/generate` handler, JSON parsing/error paths, and all React rendering.
- Files: no test files present; `package.json` has only a `lint` script (`tsc --noEmit`), no test runner.
- Risk: The default-broken model id and the unguarded parse/render paths could not be caught by CI. Regressions are invisible.
- Priority: High — at minimum add one server integration test (mocked Gemini) covering the happy path and a malformed-response path, plus a render test for `ResultDisplay` with a valid and a missing-field payload.

---

*Concerns audit: 2026-08-17*
