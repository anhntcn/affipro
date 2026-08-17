# External Integrations

**Analysis Date:** 2026-08-17

## APIs & External Services

**AI / Content Generation:**
- Google Gemini - Generates affiliate marketing content bundles (`server.ts`)
  - SDK/Client: `@google/genai` `^2.4.0` (`GoogleGenAI`)
  - Model: `gemini-3.7-flash` with `responseMimeType: application/json`
  - Auth: `GEMINI_API_KEY` environment variable
  - Invocation: server-side only (`app.post('/api/generate')`); client never touches the key

## Data Storage

**Databases:**
- None detected (no ORM, DB client, or connection config)

**File Storage:**
- Local filesystem only (static `dist/` assets served in production)

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None (no user auth; the only credential is the server-side Gemini API key)

## Monitoring & Observability

**Error Tracking:**
- None (errors logged to console in `server.ts` via `console.error`)

**Logs:**
- `console.log` / `console.error` to stdout/stderr

## CI/CD & Deployment

**Hosting:**
- Google AI Studio app (`https://ai.studio/apps/49effc89-3b20-47b7-806d-3b45a8bc2d74`)
- Self-hostable Node server (`npm run build` then `npm start`)

**CI Pipeline:**
- None detected (no CI config files)

## Environment Configuration

**Required env vars:**
- `GEMINI_API_KEY` - Google Gemini API key (required; server errors 500 if missing)

**Optional env vars:**
- `NODE_ENV` - Switches between Vite dev middleware and static serving (`server.ts`)
- `DISABLE_HMR` - Disables Vite HMR / file watching (`vite.config.ts`)

**Secrets location:**
- Local env file (e.g. `.env.local`), gitignored (`.env*`); template `.env.example` committed
- Contents not read (secret-bearing file)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/generate` - Accepts `{ productInfo, affiliateLink }`, returns generated content JSON (`server.ts`)

**Outgoing:**
- Server-to-Gemini API calls only (no outbound webhooks)

## Data Flow

1. Client submits product info + affiliate link (`src/store/useStore.ts` → `fetch('/api/generate')`)
2. Express handler validates input and calls Gemini (`server.ts`)
3. Gemini returns a JSON content bundle (Facebook post, short-video script, Telegram/Zalo deal message)
4. Server parses and returns JSON to the client store

---

*Integration audit: 2026-08-17*
