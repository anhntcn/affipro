# Coding Conventions

**Analysis Date:** 2026-08-17

## Naming Patterns

**Files:**
- React components: PascalCase matching the exported component — `src/components/InputForm.tsx`, `src/components/ResultDisplay.tsx`, `src/App.tsx`
- Store/hooks: camelCase with `use` prefix — `src/store/useStore.ts`
- Non-component modules: lowercase — `src/types.ts`, `server.ts`
- Entry points: lowercase — `src/main.tsx`

**Functions:**
- camelCase for handlers and utilities — `onSubmit`, `handleCopy`, `handleSubmit`, `generateContent`, `startServer`, `cn`
- Event handlers use `handle`/`on` prefix — `handleCopy`, `onSubmit`, `onCopy`

**Variables:**
- camelCase — `generatedContent`, `affiliateLink`, `copiedStates`, `activeTab`
- Constants use UPPER_SNAKE_CASE — `PORT` (`server.ts:12`)
- Environment variables: UPPER_SNAKE_CASE — `GEMINI_API_KEY`, `DISABLE_HMR`, `NODE_ENV`

**Types:**
- PascalCase interfaces, no `I` prefix — `AppState`, `GeneratedContent`, `ProductAnalysis`, `FacebookThreads`, `VideoScene`, `ShortVideoScript`, `FormData`
- Local union types PascalCase — `type Tab = 'analysis' | 'facebook' | 'video' | 'telegram'` (`src/components/ResultDisplay.tsx:15`)

**API data shape:**
- API response fields (from Gemini JSON schema) use snake_case — `product_name`, `hook_headline`, `on_screen_text` (`src/types.ts`). This is intentional to mirror the LLM output contract; internal TS/React identifiers stay camelCase.

## Code Style

**Formatting:**
- No formatter configured (no `.prettierrc`, no Biome). Style is hand-maintained.
- Indentation: 2 spaces throughout.
- Semicolons: always present.
- Quotes: single quotes in `src/` React code; double quotes in `server.ts`. Not enforced — mixed across the repo.
- Trailing commas used in multi-line literals.

**Linting:**
- No ESLint. The `lint` script runs the TypeScript compiler only: `tsc --noEmit` (`package.json`).
- Type checking is the sole automated quality gate.

**TypeScript config (`tsconfig.json`):**
- `target`/`lib`: ES2022 + DOM
- `moduleResolution: bundler`, `isolatedModules: true`, `moduleDetection: force`
- `jsx: react-jsx` (no need to import React for JSX)
- `allowImportingTsExtensions: true` — imports may include `.tsx` (see `src/main.tsx` importing `./App.tsx`)
- `noEmit: true` — Vite/esbuild handle emission
- Strict mode is NOT enabled — no `strict`, `noImplicitAny`, or `strictNullChecks` flags set.

## Import Organization

**Order (observed, not enforced):**
1. Third-party packages — `react`, `zustand`, `react-hook-form`, `lucide-react`, `clsx`, `tailwind-merge`, `@google/genai`, `express`
2. Local relative imports — `./store/useStore`, `../types`, `./InputForm`

**Path Aliases:**
- `@/*` maps to project root (`tsconfig.json` + `vite.config.ts`). Configured but not currently used in `src/` — code uses relative imports (`../types`, `./store/useStore`).

**Named vs default:**
- Components exported as named exports — `export const InputForm`, `export const ResultDisplay`
- `App` is the only default export (`export default function App`)

## Error Handling

**Server (`server.ts`):**
- Route handlers wrapped in `try/catch` with `catch (error: any)`.
- Validation returns early with `res.status(400).json({ error: ... })`.
- Missing config returns `res.status(500)`.
- Errors logged via `console.error("Error generating content:", error)` then returned as `res.status(500).json({ error: error.message || "..." })`.
- Throws `new Error("No response from Gemini")` for empty LLM output.

**Client (`src/store/useStore.ts`):**
- `fetch` wrapped in `try/catch` with `catch (error: any)`.
- Non-OK responses parsed defensively: `await response.json().catch(() => ({}))` then throw `new Error(errData.error || ...)`.
- Errors stored in Zustand `error` state (Vietnamese fallback message), never thrown to UI.
- `App.tsx` renders `error` conditionally in a red alert block.

**Form (`src/components/InputForm.tsx`):**
- Validation via `react-hook-form` `register` rules (`required`, `pattern`). Error messages are Vietnamese strings shown inline under each field.

**Pattern note:** `catch (error: any)` is the consistent idiom (permitted because strict typing is off). Errors are surfaced as user-facing state, not exceptions.

## Logging

**Framework:** `console` only.

**Patterns:**
- `console.error` for caught server errors (`server.ts:101`).
- `console.log` for server startup (`server.ts:122`).
- No client-side logging.

## Comments

**When to Comment:**
- Sparse. Section markers in JSX via `{/* Header */}`, `{/* Main Content */}`, `{/* Left Column */}`.
- Explanatory comments for non-obvious infra behavior — HMR/watch disabling in `vite.config.ts`, route-purpose comments in `server.ts`.
- `App.tsx` carries an Apache-2.0 SPDX license header block; other files do not.

**JSDoc/TSDoc:**
- Not used for functions or types.

## Function Design

**Size:** Small, single-purpose. Presentational sub-components (`AnalysisTab`, `FacebookTab`, `VideoTab`, `TelegramTab`, `CopyButton`) are extracted within `ResultDisplay.tsx` rather than split into files.

**Parameters:** React sub-components take a single destructured props object with an inline type — e.g. `({ data, onCopy, copied }: { ... })`.

**Return Values:** Components return JSX. The Zustand store actions are `async` and return `Promise<void>`, mutating state via `set` rather than returning values.

## Module Design

**Exports:**
- One primary component per file (named export), except co-located tab sub-components in `ResultDisplay.tsx`.
- Shared types centralized in `src/types.ts`.
- The `cn` utility (clsx + tailwind-merge) is defined and exported from `src/components/InputForm.tsx` and re-imported by `ResultDisplay.tsx`. Note: this belongs in a dedicated `lib/utils.ts` — see CONCERNS.

**Barrel Files:** None. No `index.ts` re-export files.

**State management:** Global state via a single Zustand store (`useStore`) holding `generatedContent`, `isLoading`, `error`, plus `generateContent` and `reset` actions. Local UI state (`activeTab`, `copiedStates`) uses `useState`.

**Styling:** Tailwind CSS v4 utility classes inline in JSX. Conditional classes composed with the `cn()` helper. No CSS modules or styled-components.

---

*Convention analysis: 2026-08-17*
