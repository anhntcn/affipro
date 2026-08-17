# Codebase Structure

**Analysis Date:** 2026-08-17

## Directory Layout

```
affipro/
├── server.ts               # Express BFF: /api/generate + Vite/static serving
├── index.html              # SPA HTML entry, mounts /src/main.tsx
├── vite.config.ts          # Vite config (React, Tailwind, @ alias, HMR toggle)
├── tsconfig.json           # TypeScript config (ESNext, react-jsx, @/* paths)
├── package.json            # Scripts and dependencies (Bun-managed)
├── bun.lock                # Bun lockfile
├── metadata.json           # AI Studio app metadata
├── .env.example            # Env var template (GEMINI_API_KEY)
├── README.md
├── assets/                 # Static assets (AI Studio scaffolding)
│   └── .aistudio/
└── src/
    ├── main.tsx            # React root render
    ├── App.tsx             # App shell / layout
    ├── index.css           # Tailwind entry + global styles
    ├── types.ts            # Shared GeneratedContent type contract
    ├── components/
    │   ├── InputForm.tsx   # Input form + validation (also exports cn helper)
    │   └── ResultDisplay.tsx # Tabbed result rendering + copy
    └── store/
        └── useStore.ts     # Zustand global store + API call
```

## Directory Purposes

**`src/`:**
- Purpose: All client-side application code.
- Contains: React entry, components, store, shared types, styles.
- Key files: `src/main.tsx`, `src/App.tsx`, `src/types.ts`

**`src/components/`:**
- Purpose: React UI components.
- Contains: `InputForm.tsx`, `ResultDisplay.tsx` (with inline tab sub-components).
- Key files: `src/components/InputForm.tsx`, `src/components/ResultDisplay.tsx`

**`src/store/`:**
- Purpose: Global client state and server communication.
- Contains: Single Zustand store.
- Key files: `src/store/useStore.ts`

**`assets/`:**
- Purpose: Static assets and AI Studio scaffolding.
- Contains: `.aistudio/` metadata only at present.

## Key File Locations

**Entry Points:**
- `index.html`: SPA HTML shell.
- `src/main.tsx`: React root mount.
- `server.ts`: Express server + API + dev/prod serving.

**Configuration:**
- `vite.config.ts`: Build/dev server config, `@` alias, HMR toggle via `DISABLE_HMR`.
- `tsconfig.json`: TypeScript compiler options and `@/*` path mapping.
- `.env.example`: Required env vars (`GEMINI_API_KEY`).

**Core Logic:**
- `server.ts`: Prompt construction and Gemini call.
- `src/store/useStore.ts`: State + fetch orchestration.
- `src/types.ts`: Response contract.

**Testing:**
- None present. No test files, runner, or config detected.

## Naming Conventions

**Files:**
- React components: PascalCase (`InputForm.tsx`, `ResultDisplay.tsx`).
- Store/util modules: camelCase (`useStore.ts`, `types.ts`).
- Config/server: lowercase (`server.ts`, `vite.config.ts`).

**Directories:**
- lowercase single words (`components`, `store`, `assets`).

**Symbols:**
- Interfaces: PascalCase (`GeneratedContent`, `ProductAnalysis`).
- Store hook: `use`-prefixed (`useStore`).
- Store fields on the API JSON contract use snake_case (mirrors Gemini JSON schema, e.g. `product_analysis`); TypeScript-side interfaces retain those snake_case keys.

## Where to Add New Code

**New Feature:**
- Primary UI code: `src/components/` (new PascalCase component).
- State/actions: extend `src/store/useStore.ts`.
- Server endpoints: add routes in `server.ts`.

**New Component/Module:**
- Implementation: `src/components/NewComponent.tsx`.
- Shared types: add to `src/types.ts`.

**Utilities:**
- Shared helpers: create `src/lib/utils.ts` (currently the `cn` helper lives in `src/components/InputForm.tsx:8` — relocate here when adding more utilities).

**API contract changes:**
- Update both the JSON schema in the server prompt (`server.ts`) and the interfaces in `src/types.ts` together to keep them in sync.

## Special Directories

**`assets/.aistudio/`:**
- Purpose: Google AI Studio scaffolding metadata.
- Generated: Yes (tooling).
- Committed: Yes (contains its own `.gitignore`).

**`dist/`:**
- Purpose: Build output (`vite build` + esbuild bundle to `dist/server.cjs`).
- Generated: Yes.
- Committed: No (git-ignored / cleaned via `clean` script).

---

*Structure analysis: 2026-08-17*
