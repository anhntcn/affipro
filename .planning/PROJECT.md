# Affiliate Content Pro (Affipro)

## What This Is

Một web app giúp người làm affiliate marketing tại Việt Nam biến thông tin sản phẩm thô + link tiếp thị liên kết thành một "bộ nội dung đa kênh" (Facebook/Threads, kịch bản video ngắn TikTok/Reels, tin nhắn deal Telegram/Zalo, và phân tích sản phẩm) chỉ bằng một lần bấm, dùng Gemini API. Giai đoạn đầu phục vụ nội bộ team, hướng tới có thể mở public sau.

## Core Value

Từ một mô tả sản phẩm + link affiliate, tạo ra bộ nội dung đa kênh chất lượng, tự nhiên (không "văn dịch máy"), đúng tâm lý người mua Việt — nhanh và đáng tin cậy.

## Business Context

- **Customer**: Nội bộ team affiliate/marketing trước; có thể mở cho người dùng ngoài sau.
- **Revenue model**: Chưa monetize ở giai đoạn nội bộ; để ngỏ cho giai đoạn public.
- **Success metric**: Số bộ nội dung tạo ra được dùng thật + điểm chất lượng trung bình tăng theo thời gian (vòng lặp tối ưu prompt).
- **Strategy notes**: Xem memory `affipro-vision.md` để biết đầy đủ tầm nhìn & quyết định kiến trúc.

## Requirements

### Validated

<!-- Đã build trong prototype AI Studio, xác nhận qua codebase map (.planning/codebase/). -->

- ✓ Form nhập thông tin sản phẩm + link affiliate với validation cơ bản — existing
- ✓ Gọi Gemini server-side (API key không lộ ra client) qua `/api/generate` — existing
- ✓ Trả về & hiển thị nội dung 4 kênh trên UI 4 tab (FB/Video/Tele/Phân tích) — existing
- ✓ Nút copy nội dung từng khối — existing
- ✓ Kiến trúc tách FE (Vite SPA) / BE (Express), 1 tiến trình phục vụ cả hai — existing

### Active

<!-- Hypotheses cho tới khi ship & xác nhận. -->

- [ ] Sửa để chạy đúng: đổi model hợp lệ, ép JSON bằng responseSchema, guard UI khỏi crash
- [ ] Đăng nhập bằng Google (Supabase Auth)
- [ ] Lưu lịch sử generate theo từng user
- [ ] Cấu hình khi generate: độ dài video (15/30/45/60s), giọng văn, kênh ưu tiên
- [ ] Chấm điểm để tối ưu: vote thủ công (human) + tự chấm (LLM-as-judge), lưu kèm prompt_version/config
- [ ] Dashboard đối chiếu điểm theo prompt_version/config để cải tiến prompt
- [ ] Đóng gói Docker: 1 container app + Supabase Cloud
- [ ] Public-ready: rate limit theo user, quota, phân quyền member/admin

### Out of Scope

<!-- Ranh giới rõ ràng cho giai đoạn đầu. -->

- Thanh toán/billing/subscription — chưa monetize giai đoạn nội bộ
- Multi-tenant/organization phức tạp — quá sớm, team đơn giản
- Mobile app native — web đủ dùng, ưu tiên tốc độ
- Tự sinh ảnh/video bằng AI — chỉ tạo text/kịch bản; quay dựng do người dùng làm
- Đăng bài tự động lên nền tảng (Facebook/TikTok API) — rủi ro policy, để sau

## Context

- **Codebase hiện có**: React 19 + Vite 6 + TypeScript + Zustand + Tailwind v4 (SPA), backend Express + `@google/genai`. Bun lockfile. Chưa có DB/auth/test/CI. Chi tiết ở `.planning/codebase/`.
- **Tích hợp duy nhất hiện tại**: Google Gemini (`GEMINI_API_KEY` server-side).
- **Known issues cần xử lý sớm** (từ `.planning/codebase/CONCERNS.md`): model `gemini-3.7-flash` không hợp lệ (`server.ts:85`); `JSON.parse` không schema/guard (`server.ts:97`); `.map()` không null-guard trong `ResultDisplay.tsx`; không rate limit trên `/api/generate`; `PORT=3000` hardcode; thiếu `.env.local`; metadata còn template AI Studio; zero test.
- **Prompt lõi**: đã có system prompt tiếng Việt định nghĩa role copywriter + schema JSON đầu ra 4 kênh (nằm trong `server.ts` và global CLAUDE.md).
- **Nguyên tắc chống khóa nhà cung cấp**: SPA không gọi thẳng Supabase — mọi truy vấn DB/auth đi qua Express; auth bọc sau interface mỏng `verifyUser(token)`, để sau này self-host/rời Supabase chỉ là đổi URL+key + lớp auth.

## Constraints

- **Tech stack**: Giữ React/Vite/Express/TypeScript hiện có — không rewrite sang Next.js.
- **Nền tảng dữ liệu**: Supabase (Postgres + Google OAuth + RLS) — chọn vì SQL hợp với tính năng chấm điểm/thống kê và ít lock-in (self-hostable).
- **Triển khai**: Modular monolith, 1 container app + Supabase Cloud; không microservices ở quy mô nội bộ.
- **Security**: Gemini key chỉ ở server; mọi `/api` phải verify JWT; khi public phải có rate limit + quota trước.
- **AI models**: Ưu tiên model Gemini mới nhất còn hiệu lực (thay `gemini-3.7-flash` không hợp lệ).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Chọn Supabase làm auth+DB | Postgres hợp tính năng chấm điểm/thống kê; Google OAuth + RLS sẵn; ít lock-in, self-hostable | — Pending |
| Modular monolith, 1 container + Supabase Cloud | Quy mô nội bộ cần đi nhanh, ít vận hành; microservices phản tác dụng | — Pending |
| SPA không gọi thẳng Supabase, mọi thứ qua Express | Giảm khóa nhà cung cấp; migrate off sau này chỉ đổi URL+key + lớp auth | — Pending |
| Lưu mỗi generation kèm prompt_version + config ngay từ đầu | Không có version thì không thể làm vòng lặp tối ưu về sau | — Pending |
| LLM-as-judge chạy inline trong /api/generate (chưa worker/queue) | Quy mô nhỏ chưa cần tách; tránh over-engineer | — Pending |
| Sửa lỗi chạy được (Phase 0) trước khi thêm auth/DB | Nền tảng phải đúng đã rồi mới xây tầng trạng thái | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-17 after initialization*
