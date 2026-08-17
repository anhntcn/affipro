# Affiliate Content Pro (Affipro)

Một web app giúp người làm affiliate marketing tại Việt Nam biến **thông tin sản phẩm thô + link tiếp thị liên kết** thành một **bộ nội dung đa kênh** — bài Facebook/Threads, kịch bản video ngắn TikTok/Reels, tin nhắn deal Telegram/Zalo, và phân tích sản phẩm — chỉ bằng một lần bấm, dùng **Gemini API**.

> A one-click multi-channel content generator for Vietnamese affiliate marketing, powered by Gemini. The Gemini API key stays **server-side only**.

## Tech stack

- **Client:** React 19 + Vite + TypeScript (SPA, Zustand store)
- **Server:** Express + TypeScript (`server.ts`) — proxies Gemini so the API key never reaches the browser
- **AI:** `@google/genai` (Gemini)
- **Package manager:** [Bun](https://bun.sh) (`bun.lock` is the committed lockfile)

## Prerequisites

- [Bun](https://bun.sh) installed
- A Google Gemini API key

## Run locally

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure your environment. Copy the example file and set your key:

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local` and set `GEMINI_API_KEY` (server-side only). `PORT` is optional (defaults to `3000`).

3. Run the dev server:

   ```bash
   bun run dev
   ```

   The app serves on http://localhost:3000.

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Start the Express + Vite dev server (`tsx server.ts`) |
| `bun run build` | Build the client and bundle the server to `dist/server.cjs` |
| `bun run start` | Run the production build (`node dist/server.cjs`) |
| `bun run lint` | Type-check with `tsc --noEmit` |
| `bun run test` | Run the Vitest suite once (`vitest run`) |
| `bun run check:model` | Static check that the pinned Gemini model id is in the allowlist |

## CI

Every push and pull request runs `.github/workflows/ci.yml`: `bun install --frozen-lockfile`, then `tsc --noEmit`, the full Vitest suite, and the static model-id allowlist check. No Gemini key/secret is used in CI — the SDK is mocked in tests and the allowlist check is static.
