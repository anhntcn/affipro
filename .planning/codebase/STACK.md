# Technology Stack

**Analysis Date:** 2026-08-17

## Languages

**Primary:**
- TypeScript `~5.8.2` - All application code (`server.ts`, `src/**/*.tsx`, `src/**/*.ts`)
- TSX/JSX (React) - UI components (`src/App.tsx`, `src/components/*.tsx`)

**Secondary:**
- CSS - Styling via Tailwind (`src/index.css`)
- HTML - Single entry template (`index.html`)

## Runtime

**Environment:**
- Node.js (server via Express; `dev` script uses `tsx server.ts`)
- Browser (React 19 SPA client)

**Package Manager:**
- Bun (lockfile `bun.lock` present at repo root)
- npm-compatible scripts (README instructs `npm install` / `npm run dev`)
- Lockfile: present (`bun.lock`)

## Frameworks

**Core:**
- React `^19.0.1` + React DOM `^19.0.1` - Client UI (`src/main.tsx`, `src/App.tsx`)
- Express `^4.21.2` - HTTP server and API layer (`server.ts`)
- Vite `^6.2.3` - Dev server (middleware mode) and production build (`vite.config.ts`)

**Testing:**
- Not detected (no test runner or test files present)

**Build/Dev:**
- Vite `^6.2.3` - Frontend bundling (`vite build`)
- esbuild `^0.25.0` - Server bundling to `dist/server.cjs` (`build` script)
- tsx `^4.21.0` - TypeScript execution for dev server
- TypeScript `~5.8.2` - Type checking via `lint` script (`tsc --noEmit`)

## Key Dependencies

**Critical:**
- `@google/genai` `^2.4.0` - Google Gemini SDK; core AI content generation (`server.ts`)
- `zustand` `^5.0.15` - Client state management (`src/store/useStore.ts`)
- `react-hook-form` `^7.85.0` - Form handling for input UI

**Infrastructure:**
- `dotenv` `^17.2.3` - Environment variable loading
- `@tailwindcss/vite` `^4.1.14` + `tailwindcss` `^4.1.14` - Utility-first CSS
- `autoprefixer` `^10.4.21` - CSS vendor prefixing

**UI/Utility:**
- `lucide-react` `^0.546.0` - Icon set
- `motion` `^12.23.24` - Animations
- `clsx` `^2.1.1` + `tailwind-merge` `^3.6.0` - Conditional class composition

## Configuration

**Environment:**
- Configured via environment variables loaded with `dotenv`
- `.env.example` present (template; `.env*` gitignored except the example)
- Key config required: `GEMINI_API_KEY` (read in `server.ts`), optional `NODE_ENV`, `DISABLE_HMR` (`vite.config.ts`)

**Build:**
- `vite.config.ts` - Vite plugins (React, Tailwind) and `@` path alias to repo root
- `tsconfig.json` - ES2022 target, ESNext modules, bundler resolution, `react-jsx`, `@/*` path alias, `noEmit`
- `package.json` - Scripts: `dev`, `build`, `start`, `preview`, `clean`, `lint`

## Platform Requirements

**Development:**
- Node.js (per README prerequisites)
- `GEMINI_API_KEY` set in local env file

**Production:**
- Node.js process serving `dist/server.cjs` (`npm start`)
- Server binds `0.0.0.0:3000`; serves static SPA from `dist/` and `/api/generate` endpoint
- Originated from Google AI Studio (app id `49effc89-3b20-47b7-806d-3b45a8bc2d74`)

---

*Stack analysis: 2026-08-17*
