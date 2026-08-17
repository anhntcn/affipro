# Phase 0: Fix-to-run + CI net - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 0-fix-to-run-ci-net
**Areas discussed:** Model & chất lượng output, UX khi lỗi + auto-retry, CI chạy ở đâu + verify model-id, Test runner & độ sâu integration test

---

## Model & chất lượng output

| Option | Description | Selected |
|--------|-------------|----------|
| gemini-2.5-flash + responseSchema | Flash nhanh & rẻ, đủ tốt cho content marketing; kèm typed responseSchema + Zod validate | ✓ |
| gemini-2.5-pro + responseSchema | Pro chất lượng cao hơn nhưng chậm/đắt hơn | |
| Flash, chỉ responseMimeType JSON | Không typed schema gửi Gemini, chỉ Zod server-side | |

**User's choice:** gemini-2.5-flash + responseSchema
**Notes:** Researcher phải re-verify id sống tại build-time (không mặc định đúng/sai).

---

## UX khi lỗi + auto-retry

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-retry 1 lần rồi báo lỗi | Server gọi lại 1 lần; vẫn hỏng → lỗi tiếng Việt rõ + nút thử lại | ✓ |
| Không retry, báo lỗi ngay | Hỏng là trả lỗi tiếng Việt + nút thử lại (user tự bấm) | |
| Bạn quyết định | Để researcher/planner chọn theo best practice | |

**User's choice:** Auto-retry 1 lần rồi báo lỗi
**Notes:** Kèm kiểm finishReason + ErrorBoundary/null-guard client-side.

---

## CI chạy ở đâu + verify model-id

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions + allowlist tĩnh | Init git + GitHub Actions; model-id check bằng allowlist tĩnh, không cần API key CI | ✓ |
| GitHub Actions + ping live API | CI ping Gemini thật để verify id — cần GEMINI_API_KEY secret, tốn quota | |
| CI khác (chưa dùng GitHub) | GitLab/Gitea/nội bộ khác | |

**User's choice:** GitHub Actions + allowlist tĩnh
**Notes:** Hệ quả: Phase 0 phải git init + tạo repo GitHub (hiện chưa phải git repo).

---

## Test runner & độ sâu integration test

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest, mock Gemini SDK | Vitest hợp hệ Vite; integration test /api/generate mock SDK: happy + malformed + allowlist | ✓ |
| node:test built-in | Test runner Node có sẵn, không thêm dependency | |
| Bạn quyết định | Để researcher chọn runner + mức mock | |

**User's choice:** Vitest, mock Gemini SDK
**Notes:** Thêm zod + vitest + script `test` vào package.json.

---

## Claude's Discretion

- Chi tiết mock Gemini SDK, cấu trúc thư mục test, danh sách chính xác env var fail-fast, tổ chức Zod schema/types, backoff policy cho retry.

## Deferred Ideas

- Rate limit `/api/generate` (PUB-01/PUB-02) — giai đoạn public-ready.
- Ping live Gemini API verify id trong CI — hoãn, cân nhắc lại nếu allowlist tĩnh không đủ.
