# Gemini API Capability Coverage — Phase 0

**Purpose:** API-coverage checkpoint (enforced at seal-time / `verify:pre`). This phase integrates the external Gemini SDK `@google/genai`. This table enumerates the Gemini API capability surface and records an explicit INTEGRATE / OPT-OUT decision per capability, so a later gate does not block on an undocumented omission.

**SDK:** `@google/genai` `^2.4.0` (installed) — model call is `ai.models.generateContent(...)`.
**Scope note:** Affipro is a one-shot, server-side, text-only 4-channel content generator. Only `generateContent` is needed; everything else is deliberately out of scope for the internal MVP.

| Capability | Decision | Reason |
|------------|----------|--------|
| `generateContent` (single-shot text) | **INTEGRATE** | Core seam. Product info + affiliate link → one 4-channel JSON bundle. Called once per request in `POST /api/generate`. |
| `generateContent` with `responseSchema` + `responseMimeType` (structured output) | **INTEGRATE** | FIX-02 / D-02 — constrain the model to the 4-channel shape server-side. |
| `finishReason` inspection on the response candidate | **INTEGRATE** | FIX-03 / D-04 — read `candidates[0].finishReason` before `.text` to detect SAFETY/MAX_TOKENS/truncation. |
| `streamGenerateContent` (streaming) | OPT-OUT | Not needed — app awaits the full JSON before rendering; streaming is a later UX improvement (CONCERNS "no streaming", acceptable at internal scale). |
| `embedContent` / `batchEmbedContents` | OPT-OUT | No embeddings/semantic search in this product. |
| `countTokens` | OPT-OUT | No token accounting in Phase 0; per-user token/spend quota is deferred to public-ready (PUB-02). |
| Files API (`ai.files.*`) | OPT-OUT | Text-only input; no file/image uploads. |
| Context caching (`ai.caches.*`) | OPT-OUT | Single-shot, non-repeated prompts; no cache reuse benefit at internal scale. |
| Function calling / tools | OPT-OUT | The model returns content, it does not invoke tools; not needed for content generation. |
| System instructions (`config.systemInstruction`) | OPT-OUT | Role/task are already embedded in the single prompt body (`server.ts`); no separate system-instruction split needed for the MVP. |
| Safety settings (`config.safetySettings`) | OPT-OUT | Default safety thresholds are acceptable; SAFETY blocks are handled at the `finishReason` layer (FIX-03) with a Vietnamese error, not by loosening thresholds. |
| Grounding / Google Search retrieval | OPT-OUT | Content is generated from the user-supplied product info only; no web grounding. |
| Model tuning / fine-tuning (`ai.tunings.*`) | OPT-OUT | Prompt-only approach; optimization happens via the prompt_version loop (Phases 3–4), not model tuning. |
| Batch API | OPT-OUT | One interactive request at a time; no batch workload. |
| Live / bidirectional streaming (Live API) | OPT-OUT | No real-time/audio interaction; text request/response only. |

**Summary:** 3 INTEGRATE (all facets of the single `generateContent` call path), 13 OPT-OUT. The integration footprint is intentionally minimal — one server-side call behind the `/api/generate` seam.

*Generated: 2026-08-17 — Phase 0 (Fix-to-run + CI net)*
