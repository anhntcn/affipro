# Phase 0: Fix-to-run + CI net - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Làm cho generator Gemini hiện tại chạy đúng và khoá lại bằng CI, trước khi các phase auth/DB viết lại `server.ts`. Cụ thể: đổi model id hợp lệ, ép + validate JSON output (responseSchema + Zod), guard UI khỏi crash khi thiếu field, đọc `PORT` từ env với fail-fast, dọn metadata AI Studio, và một lưới CI (allowlist model-id + happy-path + malformed integration test) chạy tự động.

**Chỉ làm rõ CÁCH implement FIX-01…FIX-06 đã trong scope.** Không thêm năng lực mới (auth, DB, config, scoring — thuộc Phase 1–5).

</domain>

<decisions>
## Implementation Decisions

### Model & Output Contract (FIX-01, FIX-02)
- **D-01:** Thay `model: "gemini-3.7-flash"` (`server.ts:85`) bằng `gemini-2.5-flash` — flash đủ tốt cho content marketing, nhanh & rẻ. **Researcher PHẢI re-verify id này còn sống theo docs Gemini sống tại build-time** (không mặc định đúng/sai); nếu id đổi, cập nhật + allowlist theo id đã verify.
- **D-02:** Gửi **typed `responseSchema`** cho Gemini (structured output ràng buộc cấu trúc 4 kênh) — không chỉ dựa `responseMimeType`.
- **D-03:** **Zod validate lần 2 server-side** trên output đã parse, trước khi trả về client (double-guard: schema từ Gemini + Zod). `zod` chưa có trong `package.json` → thêm dependency.

### Failure Handling & UX (FIX-03, FIX-04)
- **D-04:** Kiểm `finishReason` trước khi parse; nếu truncate/không phải STOP → coi là lỗi.
- **D-05:** **Auto-retry 1 lần** khi output hỏng/truncate/parse-fail; vẫn hỏng → trả lỗi **tiếng Việt rõ ràng** (không white screen) + UI có nút thử lại. (Researcher cân nhắc: retry cho lỗi transient, không retry vô ích cho lỗi schema cứng.)
- **D-06:** Client: **ErrorBoundary** + null-guard mọi `.map()`/truy cập mảng trong `ResultDisplay.tsx` để không crash khi thiếu field.

### Environment & Cleanup (FIX-05)
- **D-07:** Server đọc `PORT` từ env (thay hardcode `server.ts:12`), **boot fail-fast** với message rõ khi thiếu env var bắt buộc (tối thiểu `GEMINI_API_KEY`).
- **D-08:** Tạo `.env.local.example`; dọn metadata/README template AI Studio.

### CI & Testing (FIX-06)
- **D-09:** **Init git + tạo repo GitHub** cho project (hiện thư mục CHƯA phải git repo) → CI chạy bằng **GitHub Actions** trên mỗi thay đổi. *(Bước phụ thuộc, không phải scope mới — planner cần đưa vào.)*
- **D-10:** Model-id verify trong CI = **allowlist tĩnh** (danh sách id hợp lệ trong repo, check id dùng trong `server.ts` nằm trong allowlist) — **không cần `GEMINI_API_KEY` secret trong CI**, không tốn quota.
- **D-11:** Test runner = **Vitest** (hợp hệ Vite sẵn có). Integration test gọi handler `/api/generate` với **Gemini SDK bị mock**: (1) happy path trả JSON hợp lệ, (2) malformed/truncate → báo lỗi thay vì crash, (3) model-id allowlist check. Thêm script `test` vào `package.json`.

### Claude's Discretion
- Chi tiết cách mock Gemini SDK, cấu trúc thư mục test, chính xác các env var đưa vào fail-fast list, cách tổ chức Zod schema/types (đồng bộ với `src/types.ts`), backoff policy cho retry — researcher/planner quyết theo best practice + codebase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 0: Fix-to-run + CI net" — Goal + 4 Success Criteria (nguồn chân lý cho scope).
- `.planning/REQUIREMENTS.md` §"Fix-to-run" — FIX-01…FIX-06 chi tiết.

### Known issues & codebase state
- `.planning/codebase/CONCERNS.md` — liệt kê các bug cần xử lý (model id, JSON.parse trần, `.map` không guard, PORT hardcode, thiếu `.env.local`, metadata template, zero test).
- `.planning/codebase/STACK.md` — stack hiện có (Vite/Express/Bun) để chọn test runner/CI cho khớp.
- `.planning/codebase/TESTING.md` — trạng thái test hiện tại (chưa có).

### Files sẽ sửa
- `server.ts` — model id (`:85`), responseMimeType/schema (`:87-90`), `JSON.parse` (`:97`), `PORT` (`:12`), fail-fast env.
- `src/components/ResultDisplay.tsx` — null-guard `.map()` + tích hợp ErrorBoundary.
- `src/types.ts` — nguồn cho Zod schema (contract 4 kênh, snake_case theo LLM output).
- `package.json` — thêm `zod`, `vitest`, script `test`.

### AI model reference
- Gemini official docs (model ids còn hiệu lực) — researcher re-verify `gemini-2.5-flash` sống tại build-time; nếu đã deprecate, chọn flash mới nhất còn hiệu lực và cập nhật allowlist.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types.ts`: interfaces `GeneratedContent`/`ProductAnalysis`/`ShortVideoScript`… mirror JSON schema trong prompt — dùng làm cơ sở dựng Zod schema (giữ snake_case cho contract LLM).
- Prompt tiếng Việt định nghĩa schema JSON 4 kênh đã nằm ở `server.ts:32-82` — chuyển thành `responseSchema` typed.

### Established Patterns
- Route handler bọc `try/catch (error: any)`, validate sớm trả 400, thiếu config trả 500 (`server.ts`). Giữ pattern này khi thêm finishReason-check + retry.
- Client lưu error vào Zustand (`src/store/useStore.ts`) + render banner đỏ ở `App.tsx` — nối message lỗi tiếng Việt mới vào đây; parse phòng thủ `response.json().catch(() => ({}))` đã có.

### Integration Points
- `/api/generate` là seam duy nhất gọi Gemini — mọi thay đổi model/schema/retry tập trung tại đây; integration test target chính là handler này.
- Chưa có `.github/workflows/`, chưa có test runner, chưa có `zod` — đều là thêm mới trong phase này.

</code_context>

<specifics>
## Specific Ideas

- Lỗi tiếng Việt phải "người thật đọc hiểu", không lộ stack/JSON kỹ thuật — nhất quán với triết lý anti-"văn dịch máy" của sản phẩm.
- Ưu tiên đơn giản/rẻ ở quy mô nội bộ: allowlist tĩnh thay vì ping live API trong CI; flash thay vì pro.

</specifics>

<deferred>
## Deferred Ideas

- Rate limit `/api/generate` (PUB-01/PUB-02) — thuộc giai đoạn public-ready, không làm Phase 0 dù CONCERNS.md có nêu.
- Ping live Gemini API để verify id trong CI — cân nhắc lại nếu allowlist tĩnh tỏ ra không đủ; hiện hoãn.

**None khác — thảo luận giữ trong scope Phase 0.**

</deferred>

---

*Phase: 0-fix-to-run-ci-net*
*Context gathered: 2026-08-17*
