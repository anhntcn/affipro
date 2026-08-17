import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock the Gemini SDK BEFORE importing the server (vi.mock is hoisted).
// GoogleGenAI() returns an object exposing models.generateContent = mockGenerate.
// Type is a Proxy mapping any property access to its own name (Type.OBJECT -> "OBJECT")
// so server.ts's responseSchema construction works without the real SDK.
const mockGenerate = vi.fn();
vi.mock('@google/genai', () => ({
  // Must be `new`-able (server.ts does `new GoogleGenAI(...)`); a vi.fn arrow
  // wrapper is not a constructor, so use a plain class returning the mocked seam.
  GoogleGenAI: class {
    models = { generateContent: mockGenerate };
  },
  Type: new Proxy({}, { get: (_t, p) => String(p) }),
}));

// The mocked SDK means no live key is needed; but Plan 01 still has the
// per-request GEMINI_API_KEY presence check, so satisfy it with a dummy value.
process.env.GEMINI_API_KEY = 'test-key';

import { createApp, MODEL_ID } from '../server';

const app = createApp();

// Complete valid 4-channel fixture.
const FIXTURE = {
  product_analysis: {
    product_name: 'Máy xay sinh tố mini',
    target_audience: 'Người nội trợ, dân văn phòng',
    key_benefits: ['Nhỏ gọn', 'Giá rẻ', 'Dễ vệ sinh'],
  },
  facebook_threads: {
    hook_headline: '🔥 Máy xay mini giá sốc!',
    story_or_problem: 'Bạn mệt mỏi vì máy xay cồng kềnh?',
    product_highlights: ['Công suất cao', 'Sạc USB', 'Bảo hành 12 tháng'],
    call_to_action: 'Mua ngay: https://a.b',
    hashtags: ['#mayxay', '#deal', '#giare'],
  },
  short_video_script: {
    video_title: 'Unbox máy xay mini',
    estimated_duration: '30-45 giây',
    scenes: [
      {
        scene_number: 1,
        time_range: '0:00 - 0:03',
        visual_action: 'Cầm máy lên khoe',
        voiceover: 'Nhỏ mà có võ nè!',
        on_screen_text: 'GIÁ SỐC',
      },
    ],
  },
  instant_deal_telegram_zalo: '⚡ Deal gấp! Chốt ngay 👉 https://a.b',
};
const FIXTURE_JSON = JSON.stringify(FIXTURE);

describe('/api/generate', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('happy path returns validated 200 with the full 4-channel body', async () => {
    mockGenerate.mockResolvedValue({
      candidates: [{ finishReason: 'STOP' }],
      text: FIXTURE_JSON,
    });

    const res = await request(app)
      .post('/api/generate')
      .send({ productInfo: 'Máy xay mini', affiliateLink: 'https://a.b' });

    expect(res.status).toBe(200);
    expect(res.body.product_analysis.product_name).toBeTruthy();
    expect(res.body.facebook_threads).toBeTruthy();
    expect(res.body.short_video_script.scenes[0].scene_number).toBe(1);
    expect(res.body.instant_deal_telegram_zalo).toBeTruthy();
  });

  it('model id is a member of the allowlist', async () => {
    const { ALLOWLIST } = await import('../src/schema/modelAllowlist');
    expect(ALLOWLIST).toContain(MODEL_ID);
  });

  // ---- Failure-path hardening (Plan 00-02, FIX-03) ----------------------

  // A response body must only ever expose a Vietnamese human message under the
  // `error` key — never a stack, the raw error.message, or JSON-parser output.
  function assertNoLeak(body: any) {
    expect(Object.keys(body)).toEqual(['error']);
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    // Common leak fingerprints that must NOT appear in a client-facing message.
    expect(body.error).not.toContain('SyntaxError');
    expect(body.error).not.toContain('at ');
    expect(body.error).not.toContain('JSON');
    expect(body.error).not.toContain('finishReason');
  }

  const POST = () =>
    request(app)
      .post('/api/generate')
      .send({ productInfo: 'Máy xay mini', affiliateLink: 'https://a.b' });

  it('MAX_TOKENS then STOP+valid on retry → 200 (retried once, succeeded)', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        candidates: [{ finishReason: 'MAX_TOKENS' }],
        text: '{partial',
      })
      .mockResolvedValueOnce({
        candidates: [{ finishReason: 'STOP' }],
        text: FIXTURE_JSON,
      });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(res.body.product_analysis.product_name).toBeTruthy();
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('MAX_TOKENS on both attempts → >=400 VN error, called exactly twice', async () => {
    mockGenerate.mockResolvedValue({
      candidates: [{ finishReason: 'MAX_TOKENS' }],
      text: '{partial',
    });

    const res = await POST();

    expect(res.status).toBeGreaterThanOrEqual(400);
    assertNoLeak(res.body);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('SAFETY → >=400 VN error, called exactly ONCE (no retry), .text never parsed', async () => {
    // No `text` field at all — mirrors a real safety block where response.text
    // is undefined. If the handler read .text before finishReason it would crash.
    mockGenerate.mockResolvedValue({
      candidates: [{ finishReason: 'SAFETY' }],
    });

    const res = await POST();

    expect(res.status).toBeGreaterThanOrEqual(400);
    assertNoLeak(res.body);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('PROHIBITED_CONTENT (deterministic block) → 422 VN error, called exactly ONCE (never retried)', async () => {
    // A real Gemini deterministic block reason beyond SAFETY/RECITATION. It must
    // be treated as a content-policy block: 422, and NO wasted second paid call.
    // (Regression guard for the finishReason taxonomy — WR-01/WR-02.)
    mockGenerate.mockResolvedValue({
      candidates: [{ finishReason: 'PROHIBITED_CONTENT' }],
    });

    const res = await POST();

    expect(res.status).toBe(422);
    assertNoLeak(res.body);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('malformed JSON text on both attempts → >=400, no crash (PARSE retryable once)', async () => {
    mockGenerate.mockResolvedValue({
      candidates: [{ finishReason: 'STOP' }],
      text: 'this is not json {{{',
    });

    const res = await POST();

    expect(res.status).toBeGreaterThanOrEqual(400);
    assertNoLeak(res.body);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('valid JSON but wrong shape → >=400 immediately, called ONCE (SCHEMA not retried)', async () => {
    mockGenerate.mockResolvedValue({
      candidates: [{ finishReason: 'STOP' }],
      text: JSON.stringify({ product_analysis: { product_name: 'x' } }), // missing channels
    });

    const res = await POST();

    expect(res.status).toBeGreaterThanOrEqual(400);
    assertNoLeak(res.body);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
