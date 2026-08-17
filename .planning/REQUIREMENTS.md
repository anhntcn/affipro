# Requirements: Affiliate Content Pro (Affipro)

**Defined:** 2026-08-17
**Core Value:** Từ một mô tả sản phẩm + link affiliate, tạo ra bộ nội dung đa kênh chất lượng, tự nhiên, đúng tâm lý người mua Việt — nhanh và đáng tin cậy.

## v1 Requirements

Requirements cho bản phát hành nội bộ đầu tiên. Mỗi mục map vào một phase trong roadmap.

### Fix-to-run (Nền tảng ổn định)

- [ ] **FIX-01**: Hệ thống gọi Gemini bằng model id hợp lệ đã được xác minh tại thời điểm build (không dùng id không tồn tại)
- [ ] **FIX-02**: Phản hồi Gemini được ép cấu trúc bằng `responseSchema` và validate (Zod) trước khi trả về client
- [ ] **FIX-03**: Khi Gemini trả JSON hỏng/thiếu field/truncate, hệ thống báo lỗi rõ ràng thay vì crash (kiểm `finishReason`, guard parse)
- [ ] **FIX-04**: UI hiển thị kết quả không crash khi thiếu field (guard mọi `.map`/truy cập mảng, có ErrorBoundary)
- [ ] **FIX-05**: Server đọc `PORT` từ biến môi trường; có `.env.local.example`; dọn metadata/README template AI Studio
- [ ] **FIX-06**: Có lưới test CI (happy path + JSON hỏng + model-id allowlist) chạy tự động chống regression

### Authentication

- [ ] **AUTH-01**: User đăng nhập bằng tài khoản Google (Supabase Auth, OAuth PKCE)
- [ ] **AUTH-02**: Phiên đăng nhập được giữ qua refresh trình duyệt; user đăng xuất được
- [ ] **AUTH-03**: Mọi request `/api/*` được Express verify JWT (jose + JWKS) qua seam `verifyUser(token)`; request thiếu/hỏng token bị từ chối
- [ ] **AUTH-04**: SPA không bao giờ query DB trực tiếp — chỉ dùng Supabase SDK để lấy JWT; mọi truy cập dữ liệu đi qua Express

### History (Lịch sử)

- [ ] **HIST-01**: Mỗi lần generate được lưu vào DB kèm input, config, prompt_version, output, status, thời gian, gắn với user
- [ ] **HIST-02**: User xem được danh sách lịch sử generate của chính mình (mới nhất trước)
- [ ] **HIST-03**: User mở lại xem chi tiết một generation cũ (đủ 4 kênh)
- [ ] **HIST-04**: User chỉ thấy lịch sử của chính mình (RLS bật + Express lọc theo user_id)

### Generate Config (Cấu hình khi tạo)

- [ ] **CONF-01**: User chọn độ dài video mong muốn (ví dụ 15/30/45/60s); prompt ràng buộc số scene tương ứng
- [ ] **CONF-02**: User chọn giọng văn (ví dụ hài hước / nghiêm túc / thân thiện)
- [ ] **CONF-03**: User chọn kênh ưu tiên cần tạo nội dung
- [ ] **CONF-04**: Cấu hình được lưu vào `config` (jsonb) của generation để phục vụ đối chiếu điểm

### Scoring (Chấm điểm để tối ưu)

- [ ] **SCORE-01**: User chấm nhanh mỗi bộ nội dung bằng feedback nhị phân (👍/👎), không dùng thang 5 sao
- [ ] **SCORE-02**: LLM-as-judge tự chấm mỗi generation theo rubric phân tích (hook, độ tự nhiên/anti-"văn dịch máy", CTA), theo từng kênh
- [ ] **SCORE-03**: Điểm lưu ở bảng `scores` riêng (source: human|llm_judge, metric, value, note) gắn theo generation_id
- [ ] **SCORE-04**: LLM-judge chạy inline trong `/api/generate`, đặt sau interface `services/judge.ts` để sau tách worker không đổi schema
- [ ] **SCORE-05**: Regenerate tạo bản ghi mới (branch), không ghi đè bản cũ — giữ nguyên lịch sử điểm để so sánh

### Dashboard (Đối chiếu tối ưu)

- [ ] **DASH-01**: Dashboard hiển thị điểm trung bình theo `prompt_version`
- [ ] **DASH-02**: Dashboard hiển thị điểm trung bình theo `config` (độ dài video / giọng văn / kênh)
- [ ] **DASH-03**: Dashboard hiển thị mức đồng thuận human-vs-judge (agreement) để kiểm chứng độ tin cậy của auto-score
- [ ] **DASH-04**: So sánh side-by-side hai `prompt_version` (điểm + nội dung mẫu)

### Deployment

- [ ] **DEPLOY-01**: App đóng gói thành 1 Docker container (Express serve SPA build + `/api`), cấu hình qua biến môi trường
- [ ] **DEPLOY-02**: Kết nối Supabase Cloud qua `db/client.ts` (seam duy nhất giữ URL+key), có tài liệu đường migrate sang self-host

## v2 Requirements

Ghi nhận nhưng hoãn — chưa nằm trong roadmap hiện tại.

### Public-ready

- **PUB-01**: Rate limit `/api/*` theo user (express-rate-limit in-memory ở single container)
- **PUB-02**: Giới hạn độ dài input + hạn mức token/spend theo user (kiểm soát chi phí, không chỉ đếm request)
- **PUB-03**: Phân quyền member/admin qua `app_metadata` (RBAC)
- **PUB-04**: Rate limiter phân tán (rate-limiter-flexible + Redis) khi vượt 1 container

### Self-host

- **HOST-01**: Migrate từ Supabase Cloud sang self-host Supabase trong Docker (khi cần data on-prem)

## Out of Scope

Loại trừ rõ ràng để tránh phình scope.

| Feature | Reason |
|---------|--------|
| Thang điểm 5 sao | Anti-feature — thêm nhiễu, không cải thiện độ đồng thuận; dùng nhị phân |
| Blended single score | Che giấu tradeoff mà vòng tối ưu cần thấy; chấm per-channel/per-criterion |
| Worker/queue cho judge | Quá sớm ở quy mô nội bộ; chạy inline, để đường tách sau |
| Auto-prompt-optimization | Cần con người trong vòng lặp trước; tự động hoá quá sớm rủi ro |
| Full BI suite | Dashboard tối giản đủ dùng; không dựng BI phức tạp |
| Thanh toán/billing | Chưa monetize giai đoạn nội bộ |
| Multi-tenant/organization | Quá sớm, team đơn giản |
| Mobile app native | Web-first, ưu tiên tốc độ |
| Sinh ảnh/video bằng AI | Chỉ tạo text/kịch bản; quay dựng do người dùng |
| Auto-đăng lên Facebook/TikTok | Rủi ro policy nền tảng, để sau |

## Traceability

Mapping từ ROADMAP.md (6 phases: 0–5).

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 0 | Pending |
| FIX-02 | Phase 0 | Pending |
| FIX-03 | Phase 0 | Pending |
| FIX-04 | Phase 0 | Pending |
| FIX-05 | Phase 0 | Pending |
| FIX-06 | Phase 0 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| HIST-01 | Phase 2 | Pending |
| HIST-02 | Phase 2 | Pending |
| HIST-03 | Phase 2 | Pending |
| HIST-04 | Phase 2 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |
| CONF-04 | Phase 2 | Pending |
| SCORE-01 | Phase 3 | Pending |
| SCORE-02 | Phase 3 | Pending |
| SCORE-03 | Phase 3 | Pending |
| SCORE-04 | Phase 3 | Pending |
| SCORE-05 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-17*
*Last updated: 2026-08-17 after roadmap traceability mapping*
