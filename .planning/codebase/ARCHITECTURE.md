<!-- refreshed: 2026-08-17 -->
# Architecture

**Analysis Date:** 2026-08-17

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                       │
├──────────────────┬──────────────────┬───────────────────────┤
│    App shell     │   InputForm      │    ResultDisplay      │
│  `src/App.tsx`   │ `src/components/ │  `src/components/     │
│                  │  InputForm.tsx`  │  ResultDisplay.tsx`   │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Zustand store (client state + fetch)            │
│         `src/store/useStore.ts`                              │
└─────────────────────────────┬───────────────────────────────┘
                              │ POST /api/generate (fetch)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Express server (BFF / API proxy)                │
│         `server.ts`                                          │
└─────────────────────────────┬───────────────────────────────┘
                              │ generateContent()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│        Google Gemini API (@google/genai, external)          │
│        model: gemini-3.7-flash, JSON response mode          │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App shell | Layout, header, conditional rendering of empty state vs. results, error banner | `src/App.tsx` |
| InputForm | Collect raw product info + affiliate link, validate, trigger generation | `src/components/InputForm.tsx` |
| ResultDisplay | Tabbed rendering of generated content (Facebook, Video, Telegram, Analysis), copy-to-clipboard | `src/components/ResultDisplay.tsx` |
| useStore | Client state (generatedContent, isLoading, error), API call orchestration, reset | `src/store/useStore.ts` |
| Express server | Single API route `/api/generate`, Gemini proxy, prompt construction, Vite middleware / static serving | `server.ts` |
| Types | Shared response contract between server output and UI rendering | `src/types.ts` |

## Pattern Overview

**Overall:** Single-page React application with a thin Express Backend-for-Frontend (BFF) that proxies a single AI generation call.

**Key Characteristics:**
- Client-side rendered SPA (React 19 + Vite) with a global Zustand store as the single source of truth.
- Express server acts purely as an API proxy to Google Gemini, keeping the API key server-side.
- One-shot request/response flow: no persistence, no database, no authentication.

## Layers

**Presentation (React components):**
- Purpose: Render UI and capture user input.
- Location: `src/App.tsx`, `src/components/`
- Contains: Functional React components, Tailwind styling, react-hook-form validation.
- Depends on: Zustand store, shared types, lucide-react icons.
- Used by: `src/main.tsx` (root render).

**State / data-access (Zustand store):**
- Purpose: Hold app state and perform the fetch to the server.
- Location: `src/store/useStore.ts`
- Contains: State fields, `generateContent` async action, `reset` action.
- Depends on: `fetch`, `src/types.ts`.
- Used by: All components via `useStore()`.

**Server (Express BFF):**
- Purpose: Expose `/api/generate`, build the Gemini prompt, call the model, return parsed JSON.
- Location: `server.ts`
- Contains: Express app, route handler, Gemini client setup, Vite dev middleware / production static serving.
- Depends on: `@google/genai`, `express`, `vite`, `GEMINI_API_KEY` env var.
- Used by: The browser via HTTP.

## Data Flow

### Primary Request Path

1. User fills `productInfo` and `affiliateLink` and submits the form (`src/components/InputForm.tsx:21`).
2. `generateContent` action sets loading and POSTs JSON to `/api/generate` (`src/store/useStore.ts:16`).
3. Express handler validates input, reads `GEMINI_API_KEY`, builds the Vietnamese copywriting prompt, calls Gemini in JSON mode (`server.ts:17`).
4. Server parses the model's JSON text and returns it as the response (`server.ts:97`).
5. Store saves `generatedContent`, clears loading (`src/store/useStore.ts:32`).
6. `App` renders `ResultDisplay`, which shows tabbed output (`src/App.tsx:48`, `src/components/ResultDisplay.tsx:39`).

### Error Flow

1. Server returns a non-2xx with `{ error }` on missing input, missing key, or Gemini failure (`server.ts:22`, `server.ts:100`).
2. Store catches, sets `error`, clears loading (`src/store/useStore.ts:34`).
3. `App` renders the red error banner (`src/App.tsx:38`).

**State Management:**
- Single global Zustand store; no local persistence. Transient UI state (active tab, copied indicators) is component-local `useState` in `ResultDisplay`.

## Key Abstractions

**GeneratedContent contract:**
- Purpose: Typed shape of the AI response shared by server output and UI.
- Examples: `src/types.ts`
- Pattern: Interfaces mirroring the JSON schema embedded in the server prompt.

**Global store hook:**
- Purpose: Single access point for state and the generation action.
- Examples: `src/store/useStore.ts`
- Pattern: Zustand `create` with async actions.

## Entry Points

**Client entry:**
- Location: `src/main.tsx`
- Triggers: Loaded by `index.html` via `<script type="module" src="/src/main.tsx">`.
- Responsibilities: Mount `<App />` into `#root` under `StrictMode`.

**Server entry:**
- Location: `server.ts`
- Triggers: `bun run dev` (tsx) or `node dist/server.cjs` (production).
- Responsibilities: Start Express on port 3000, wire API route and Vite/static serving.

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop (Express); browser main thread for React.
- **Global state:** One Zustand store singleton (`src/store/useStore.ts`); no server-side session state.
- **Circular imports:** None observed. Note `cn` helper is exported from `src/components/InputForm.tsx` and imported by `ResultDisplay.tsx` (utility living in a component file).
- **Secrets:** `GEMINI_API_KEY` must remain server-side only; never expose to the client bundle.
- **Hardcoded config:** Port `3000` is hardcoded in `server.ts`.

## Anti-Patterns

### Utility function exported from a component module

**What happens:** The `cn()` Tailwind class-merge helper is defined and exported in `src/components/InputForm.tsx:8` and imported by `src/components/ResultDisplay.tsx:13`.
**Why it's wrong:** Couples an unrelated component to a form component just to reuse a helper; hurts discoverability.
**Do this instead:** Move `cn()` to a dedicated `src/lib/utils.ts` and import it from there in both components.

### Unguarded JSON.parse of model output

**What happens:** `server.ts:97` calls `JSON.parse(text)` directly on the Gemini response.
**Why it's wrong:** If the model returns malformed or non-JSON text, the parse throws and is only caught by the generic outer handler, returning a vague 500.
**Do this instead:** Wrap parsing with a targeted try/catch that surfaces a clear "invalid model output" error, and validate against the `GeneratedContent` shape before returning.

## Error Handling

**Strategy:** Try/catch on both tiers; errors flow back as `{ error }` JSON and surface in the UI banner.

**Patterns:**
- Server: input validation returns 400; missing key returns 500; catch-all returns `error.message` (`server.ts:100`).
- Client: store catch sets a user-facing (Vietnamese) fallback message (`src/store/useStore.ts:34`).

## Cross-Cutting Concerns

**Logging:** `console.error` on the server only (`server.ts:101`). No structured logging.
**Validation:** Client-side via react-hook-form (required + URL pattern); server-side presence check only.
**Authentication:** None. The API route is open.

---

*Architecture analysis: 2026-08-17*
