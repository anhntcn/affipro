<!-- GSD:project-start source:PROJECT.md -->

## Project

**Affiliate Content Pro (Affipro)**

Một web app giúp người làm affiliate marketing tại Việt Nam biến thông tin sản phẩm thô + link tiếp thị liên kết thành một "bộ nội dung đa kênh" (Facebook/Threads, kịch bản video ngắn TikTok/Reels, tin nhắn deal Telegram/Zalo, và phân tích sản phẩm) chỉ bằng một lần bấm, dùng Gemini API. Giai đoạn đầu phục vụ nội bộ team, hướng tới có thể mở public sau.

**Core Value:** Từ một mô tả sản phẩm + link affiliate, tạo ra bộ nội dung đa kênh chất lượng, tự nhiên (không "văn dịch máy"), đúng tâm lý người mua Việt — nhanh và đáng tin cậy.

### Constraints

- **Tech stack**: Giữ React/Vite/Express/TypeScript hiện có — không rewrite sang Next.js.
- **Nền tảng dữ liệu**: Supabase (Postgres + Google OAuth + RLS) — chọn vì SQL hợp với tính năng chấm điểm/thống kê và ít lock-in (self-hostable).
- **Triển khai**: Modular monolith, 1 container app + Supabase Cloud; không microservices ở quy mô nội bộ.
- **Security**: Gemini key chỉ ở server; mọi `/api` phải verify JWT; khi public phải có rate limit + quota trước.
- **AI models**: Ưu tiên model Gemini mới nhất còn hiệu lực (thay `gemini-3.7-flash` không hợp lệ).

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript `~5.8.2` - All application code (`server.ts`, `src/**/*.tsx`, `src/**/*.ts`)
- TSX/JSX (React) - UI components (`src/App.tsx`, `src/components/*.tsx`)
- CSS - Styling via Tailwind (`src/index.css`)
- HTML - Single entry template (`index.html`)

## Runtime

- Node.js (server via Express; `dev` script uses `tsx server.ts`)
- Browser (React 19 SPA client)
- Bun (lockfile `bun.lock` present at repo root)
- npm-compatible scripts (README instructs `npm install` / `npm run dev`)
- Lockfile: present (`bun.lock`)

## Frameworks

- React `^19.0.1` + React DOM `^19.0.1` - Client UI (`src/main.tsx`, `src/App.tsx`)
- Express `^4.21.2` - HTTP server and API layer (`server.ts`)
- Vite `^6.2.3` - Dev server (middleware mode) and production build (`vite.config.ts`)
- Not detected (no test runner or test files present)
- Vite `^6.2.3` - Frontend bundling (`vite build`)
- esbuild `^0.25.0` - Server bundling to `dist/server.cjs` (`build` script)
- tsx `^4.21.0` - TypeScript execution for dev server
- TypeScript `~5.8.2` - Type checking via `lint` script (`tsc --noEmit`)

## Key Dependencies

- `@google/genai` `^2.4.0` - Google Gemini SDK; core AI content generation (`server.ts`)
- `zustand` `^5.0.15` - Client state management (`src/store/useStore.ts`)
- `react-hook-form` `^7.85.0` - Form handling for input UI
- `dotenv` `^17.2.3` - Environment variable loading
- `@tailwindcss/vite` `^4.1.14` + `tailwindcss` `^4.1.14` - Utility-first CSS
- `autoprefixer` `^10.4.21` - CSS vendor prefixing
- `lucide-react` `^0.546.0` - Icon set
- `motion` `^12.23.24` - Animations
- `clsx` `^2.1.1` + `tailwind-merge` `^3.6.0` - Conditional class composition

## Configuration

- Configured via environment variables loaded with `dotenv`
- `.env.example` present (template; `.env*` gitignored except the example)
- Key config required: `GEMINI_API_KEY` (read in `server.ts`), optional `NODE_ENV`, `DISABLE_HMR` (`vite.config.ts`)
- `vite.config.ts` - Vite plugins (React, Tailwind) and `@` path alias to repo root
- `tsconfig.json` - ES2022 target, ESNext modules, bundler resolution, `react-jsx`, `@/*` path alias, `noEmit`
- `package.json` - Scripts: `dev`, `build`, `start`, `preview`, `clean`, `lint`

## Platform Requirements

- Node.js (per README prerequisites)
- `GEMINI_API_KEY` set in local env file
- Node.js process serving `dist/server.cjs` (`npm start`)
- Server binds `0.0.0.0:3000`; serves static SPA from `dist/` and `/api/generate` endpoint
- Originated from Google AI Studio (app id `49effc89-3b20-47b7-806d-3b45a8bc2d74`)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase matching the exported component — `src/components/InputForm.tsx`, `src/components/ResultDisplay.tsx`, `src/App.tsx`
- Store/hooks: camelCase with `use` prefix — `src/store/useStore.ts`
- Non-component modules: lowercase — `src/types.ts`, `server.ts`
- Entry points: lowercase — `src/main.tsx`
- camelCase for handlers and utilities — `onSubmit`, `handleCopy`, `handleSubmit`, `generateContent`, `startServer`, `cn`
- Event handlers use `handle`/`on` prefix — `handleCopy`, `onSubmit`, `onCopy`
- camelCase — `generatedContent`, `affiliateLink`, `copiedStates`, `activeTab`
- Constants use UPPER_SNAKE_CASE — `PORT` (`server.ts:12`)
- Environment variables: UPPER_SNAKE_CASE — `GEMINI_API_KEY`, `DISABLE_HMR`, `NODE_ENV`
- PascalCase interfaces, no `I` prefix — `AppState`, `GeneratedContent`, `ProductAnalysis`, `FacebookThreads`, `VideoScene`, `ShortVideoScript`, `FormData`
- Local union types PascalCase — `type Tab = 'analysis' | 'facebook' | 'video' | 'telegram'` (`src/components/ResultDisplay.tsx:15`)
- API response fields (from Gemini JSON schema) use snake_case — `product_name`, `hook_headline`, `on_screen_text` (`src/types.ts`). This is intentional to mirror the LLM output contract; internal TS/React identifiers stay camelCase.

## Code Style

- No formatter configured (no `.prettierrc`, no Biome). Style is hand-maintained.
- Indentation: 2 spaces throughout.
- Semicolons: always present.
- Quotes: single quotes in `src/` React code; double quotes in `server.ts`. Not enforced — mixed across the repo.
- Trailing commas used in multi-line literals.
- No ESLint. The `lint` script runs the TypeScript compiler only: `tsc --noEmit` (`package.json`).
- Type checking is the sole automated quality gate.
- `target`/`lib`: ES2022 + DOM
- `moduleResolution: bundler`, `isolatedModules: true`, `moduleDetection: force`
- `jsx: react-jsx` (no need to import React for JSX)
- `allowImportingTsExtensions: true` — imports may include `.tsx` (see `src/main.tsx` importing `./App.tsx`)
- `noEmit: true` — Vite/esbuild handle emission
- Strict mode is NOT enabled — no `strict`, `noImplicitAny`, or `strictNullChecks` flags set.

## Import Organization

- `@/*` maps to project root (`tsconfig.json` + `vite.config.ts`). Configured but not currently used in `src/` — code uses relative imports (`../types`, `./store/useStore`).
- Components exported as named exports — `export const InputForm`, `export const ResultDisplay`
- `App` is the only default export (`export default function App`)

## Error Handling

- Route handlers wrapped in `try/catch` with `catch (error: any)`.
- Validation returns early with `res.status(400).json({ error: ... })`.
- Missing config returns `res.status(500)`.
- Errors logged via `console.error("Error generating content:", error)` then returned as `res.status(500).json({ error: error.message || "..." })`.
- Throws `new Error("No response from Gemini")` for empty LLM output.
- `fetch` wrapped in `try/catch` with `catch (error: any)`.
- Non-OK responses parsed defensively: `await response.json().catch(() => ({}))` then throw `new Error(errData.error || ...)`.
- Errors stored in Zustand `error` state (Vietnamese fallback message), never thrown to UI.
- `App.tsx` renders `error` conditionally in a red alert block.
- Validation via `react-hook-form` `register` rules (`required`, `pattern`). Error messages are Vietnamese strings shown inline under each field.

## Logging

- `console.error` for caught server errors (`server.ts:101`).
- `console.log` for server startup (`server.ts:122`).
- No client-side logging.

## Comments

- Sparse. Section markers in JSX via `{/* Header */}`, `{/* Main Content */}`, `{/* Left Column */}`.
- Explanatory comments for non-obvious infra behavior — HMR/watch disabling in `vite.config.ts`, route-purpose comments in `server.ts`.
- `App.tsx` carries an Apache-2.0 SPDX license header block; other files do not.
- Not used for functions or types.

## Function Design

## Module Design

- One primary component per file (named export), except co-located tab sub-components in `ResultDisplay.tsx`.
- Shared types centralized in `src/types.ts`.
- The `cn` utility (clsx + tailwind-merge) is defined and exported from `src/components/InputForm.tsx` and re-imported by `ResultDisplay.tsx`. Note: this belongs in a dedicated `lib/utils.ts` — see CONCERNS.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- Client-side rendered SPA (React 19 + Vite) with a global Zustand store as the single source of truth.
- Express server acts purely as an API proxy to Google Gemini, keeping the API key server-side.
- One-shot request/response flow: no persistence, no database, no authentication.

## Layers

- Purpose: Render UI and capture user input.
- Location: `src/App.tsx`, `src/components/`
- Contains: Functional React components, Tailwind styling, react-hook-form validation.
- Depends on: Zustand store, shared types, lucide-react icons.
- Used by: `src/main.tsx` (root render).
- Purpose: Hold app state and perform the fetch to the server.
- Location: `src/store/useStore.ts`
- Contains: State fields, `generateContent` async action, `reset` action.
- Depends on: `fetch`, `src/types.ts`.
- Used by: All components via `useStore()`.
- Purpose: Expose `/api/generate`, build the Gemini prompt, call the model, return parsed JSON.
- Location: `server.ts`
- Contains: Express app, route handler, Gemini client setup, Vite dev middleware / production static serving.
- Depends on: `@google/genai`, `express`, `vite`, `GEMINI_API_KEY` env var.
- Used by: The browser via HTTP.

## Data Flow

### Primary Request Path

### Error Flow

- Single global Zustand store; no local persistence. Transient UI state (active tab, copied indicators) is component-local `useState` in `ResultDisplay`.

## Key Abstractions

- Purpose: Typed shape of the AI response shared by server output and UI.
- Examples: `src/types.ts`
- Pattern: Interfaces mirroring the JSON schema embedded in the server prompt.
- Purpose: Single access point for state and the generation action.
- Examples: `src/store/useStore.ts`
- Pattern: Zustand `create` with async actions.

## Entry Points

- Location: `src/main.tsx`
- Triggers: Loaded by `index.html` via `<script type="module" src="/src/main.tsx">`.
- Responsibilities: Mount `<App />` into `#root` under `StrictMode`.
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

### Unguarded JSON.parse of model output

## Error Handling

- Server: input validation returns 400; missing key returns 500; catch-all returns `error.message` (`server.ts:100`).
- Client: store catch sets a user-facing (Vietnamese) fallback message (`src/store/useStore.ts:34`).

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
