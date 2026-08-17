import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createServer as createViteServer } from "vite";
import { MODEL_ID } from "./src/schema/modelAllowlist";
import { GeneratedContentSchema } from "./src/schema/generatedContent";
import { loadEnv } from "./server/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Re-export the pinned model id so tests / callers import it from one place.
export { MODEL_ID };

// Typed structured-output schema sent to Gemini (D-02, Pattern 2). Mirrors the
// 4-channel shape; scene_number uses NUMBER (INTEGER is unreliable per Pitfall 4).
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    product_analysis: {
      type: Type.OBJECT,
      properties: {
        product_name: { type: Type.STRING },
        target_audience: { type: Type.STRING },
        key_benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["product_name", "target_audience", "key_benefits"],
    },
    facebook_threads: {
      type: Type.OBJECT,
      properties: {
        hook_headline: { type: Type.STRING },
        story_or_problem: { type: Type.STRING },
        product_highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
        call_to_action: { type: Type.STRING },
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        "hook_headline",
        "story_or_problem",
        "product_highlights",
        "call_to_action",
        "hashtags",
      ],
    },
    short_video_script: {
      type: Type.OBJECT,
      properties: {
        video_title: { type: Type.STRING },
        estimated_duration: { type: Type.STRING },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scene_number: { type: Type.NUMBER },
              time_range: { type: Type.STRING },
              visual_action: { type: Type.STRING },
              voiceover: { type: Type.STRING },
              on_screen_text: { type: Type.STRING },
            },
            required: [
              "scene_number",
              "time_range",
              "visual_action",
              "voiceover",
              "on_screen_text",
            ],
          },
        },
      },
      required: ["video_title", "estimated_duration", "scenes"],
    },
    instant_deal_telegram_zalo: { type: Type.STRING },
  },
  required: [
    "product_analysis",
    "facebook_threads",
    "short_video_script",
    "instant_deal_telegram_zalo",
  ],
};

// Failure taxonomy for the generate seam (Pattern 3, D-04/D-05).
// Deterministic Gemini content blocks (every reason in DETERMINISTIC_BLOCK_FINISH
// below) plus a hard Zod-shape failure (SCHEMA) are NEVER retried — a second
// identical call wastes a paid round-trip and fails the same way. MAX_TOKENS /
// OTHER / EMPTY / PARSE are transient and get exactly ONE retry.
type FailReason =
  | "SAFETY"
  | "RECITATION"
  | "SCHEMA"
  | "MAX_TOKENS"
  | "OTHER"
  | "EMPTY"
  | "PARSE";

// finishReasons that are deterministic content-policy blocks — never retried.
// Gemini emits more of these than SAFETY/RECITATION; a real block missing from
// this set would be (incorrectly) treated as transient and retried once for
// nothing, violating the "never retry deterministic" rule.
const DETERMINISTIC_BLOCK_FINISH = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);

// NOTE: this project does not enable strictNullChecks (see tsconfig.json), so a
// `{ ok: true } | { ok: false }` discriminated union does NOT narrow reliably.
// Use a single flat shape with optional failure fields and branch on `ok`
// explicitly; `reason`/`retryable` are only meaningful when `ok === false`.
type GenerateOutcome = {
  ok: boolean;
  data?: unknown;
  reason?: FailReason;
  retryable?: boolean;
};

// Map every internal failure reason to a clear, human-written Vietnamese message.
// CRITICAL (T-00-06): the returned message must never contain a stack trace, the
// raw error.message, or JSON-parser output. Technical detail is logged
// server-side only via console.error.
function vietnameseErrorFor(reason: FailReason): { status: number; message: string } {
  switch (reason) {
    case "SAFETY":
    case "RECITATION":
      return {
        status: 422,
        message:
          "Nội dung sản phẩm có thể vi phạm chính sách nên AI đã từ chối tạo. Vui lòng chỉnh sửa mô tả và thử lại.",
      };
    case "SCHEMA":
      return {
        status: 502,
        message:
          "AI trả về nội dung không đúng định dạng mong đợi. Vui lòng thử tạo lại sau giây lát.",
      };
    case "MAX_TOKENS":
    case "OTHER":
    case "EMPTY":
    case "PARSE":
    default:
      return {
        status: 502,
        message:
          "Không tạo được nội dung do phản hồi từ AI bị lỗi hoặc chưa hoàn chỉnh. Vui lòng thử lại.",
      };
  }
}

// Single attempt against the model. Reads finishReason BEFORE .text (Pitfall 3 —
// .text is undefined on safety blocks), guards JSON.parse, then Zod-validates.
async function generateOnce(
  ai: GoogleGenAI,
  prompt: string,
): Promise<GenerateOutcome> {
  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  // finishReason FIRST — on a content block there is no text part to read.
  // Normalize the raw finishReason into our FailReason taxonomy so the union
  // stays sound (no unchecked cast) and deterministic blocks never retry.
  const finish = response.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    if (DETERMINISTIC_BLOCK_FINISH.has(finish)) {
      // Any content-policy block → the same 422 "content may violate policy"
      // path as SAFETY, and never a wasted retry.
      return { ok: false, reason: "SAFETY", retryable: false };
    }
    // MAX_TOKENS and any other non-STOP reason are transient → exactly one retry.
    const reason: FailReason = finish === "MAX_TOKENS" ? "MAX_TOKENS" : "OTHER";
    return { ok: false, reason, retryable: true };
  }

  const text = response.text;
  if (!text) {
    return { ok: false, reason: "EMPTY", retryable: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Transient formatting glitch — retry once may return valid JSON.
    return { ok: false, reason: "PARSE", retryable: true };
  }

  // Double-guard (D-03): a hard shape failure is deterministic — never retry.
  const result = GeneratedContentSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "SCHEMA", retryable: false };
  }

  return { ok: true, data: result.data };
}

// The /api/generate handler — extracted so it can be tested without Vite.
async function generateHandler(req: express.Request, res: express.Response) {
  try {
    const { productInfo, affiliateLink } = req.body;

    if (!productInfo || !affiliateLink) {
      return res.status(400).json({ error: "Missing productInfo or affiliateLink" });
    }

    // Defensive per-request fallback; primary fail-fast env check is loadEnv() at boot.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
VAI TRÒ (ROLE)
Bạn là một Chuyên gia Copywriting & Growth Marketer hàng đầu trong lĩnh vực Affiliate Marketing và E-commerce tại thị trường Việt Nam. Bạn hiểu sâu sắc tâm lý khách hàng, hành vi mua sắm trực tuyến (Shopee, TikTok Shop, Lazada), và các công thức viết bài chuyển đổi cao (AIDA, PAS, FAB).

NHIỆM VỤ (MISSION)
Khi nhận được thông tin sản phẩm thô (Raw Product Info) và một Đường link tiếp thị liên kết (Affiliate Link) dưới đây, bạn phải phân tích các điểm bán hàng độc nhất (USP) và chuyển đổi thành một "Bộ nội dung Đa kênh" (Omnichannel Content Bundle).

THÔNG TIN SẢN PHẨM (RAW PRODUCT INFO):
${productInfo}

ĐƯỜNG LINK AFFILIATE (AFFILIATE LINK):
${affiliateLink}

NGUYÊN TẮC VIẾT NỘI DUNG (CONTENT GUIDELINES)
1. Phong cách ngôn ngữ: Tự nhiên, bắt trend, đánh trúng tâm lý ham rẻ/thích đồ tiện ích của người Việt. Tuyệt đối KHÔNG dùng văn phong dịch thuật máy móc.
2. Chèn Link Affiliate: Tự động lồng ghép link được cung cấp vào các vị trí Call To Action (CTA) một cách tự nhiên và kích thích bấm nhất.
3. Kịch bản Video ngắn (TikTok/Reels/Shorts): Thời lượng thiết kế cho 30 - 45 giây. Phải có "3 giây đầu tiên (Hook)" cực mạnh.
4. Tin nhắn Deal gấp (Telegram/Zalo): Ngắn gọn dưới 100 từ, dùng nhiều emoji, tạo hiệu ứng FOMO (sắp hết hàng, mã giảm giá có hạn).

QUY ĐỊNH BẮT BUỘC VỀ ĐỊNH DẠNG ĐẦU RA (OUTPUT JSON SCHEMA)
Bạn BẮT BUỘC phải trả về kết quả dưới dạng một JSON Object duy nhất, tuân thủ 100% cấu trúc sau, không thêm bất kỳ văn bản giải thích nào ngoài JSON:

{
  "product_analysis": {
    "product_name": "Tên sản phẩm được chuẩn hóa",
    "target_audience": "Đối tượng khách hàng mục tiêu",
    "key_benefits": ["Lợi ích 1", "Lợi ích 2", "Lợi ích 3"]
  },
  "facebook_threads": {
    "hook_headline": "Tiêu đề giật tít kèm icon",
    "story_or_problem": "Đoạn dẫn dắt nêu vấn đề hoặc câu chuyện ngắn",
    "product_highlights": ["Điểm nổi bật 1", "Điểm nổi bật 2", "Điểm nổi bật 3"],
    "call_to_action": "Lời kêu gọi hành động kèm Link Affiliate",
    "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
  },
  "short_video_script": {
    "video_title": "Ý tưởng tiêu đề video TikTok",
    "estimated_duration": "30-45 giây",
    "scenes": [
      {
        "scene_number": 1,
        "time_range": "0:00 - 0:03",
        "visual_action": "Hành động/Hình ảnh xuất hiện trên màn hình (Visual Cue)",
        "voiceover": "Lời thoại của người nói (Voiceover)",
        "on_screen_text": "Chữ nổi trên màn hình"
      }
    ]
  },
  "instant_deal_telegram_zalo": "Nội dung tin nhắn ngắn, nhiều icon, giục giã, kèm link mua ngay"
}
      `;

    // First attempt; retry EXACTLY ONCE only for transient reasons (D-05).
    const first = await generateOnce(ai, prompt);
    let outcome: GenerateOutcome = first;
    if (!first.ok && first.retryable) {
      console.error(
        `Generate attempt failed (reason=${first.reason}); retrying once.`,
      );
      outcome = await generateOnce(ai, prompt);
    }

    if (outcome.ok) {
      return res.json(outcome.data);
    }

    // Failure after the bounded retry policy: log the technical reason
    // server-side, return a leak-free Vietnamese message to the client (T-00-06).
    const reason: FailReason = outcome.reason ?? "OTHER";
    console.error(`Generate failed after retry policy: reason=${reason}`);
    const { status, message } = vietnameseErrorFor(reason);
    return res.status(status).json({ error: message });
  } catch (error: any) {
    // Unexpected transport/SDK error — log detail server-side, never leak it.
    console.error("Error generating content:", error);
    return res.status(502).json({
      error:
        "Không tạo được nội dung do phản hồi từ AI bị lỗi hoặc chưa hoàn chỉnh. Vui lòng thử lại.",
    });
  }
}

// Vite-free Express app: importable in tests without booting Vite or listen().
export function createApp() {
  const app = express();
  app.use(express.json({ limit: "32kb" })); // caps prompt-injection / oversized-body surface (V5)
  app.post("/api/generate", generateHandler);
  return app;
}

// Full server: createApp() + Vite dev middleware / static serving + listen().
async function startServer() {
  // Fail-fast env validation at BOOT (D-07): missing GEMINI_API_KEY exits the
  // process here with a clear message rather than surfacing as a per-request 500.
  // Not called from createApp() / import-time so tests never need a real key.
  const env = loadEnv();
  const app = createApp();
  const PORT = env.PORT; // read from environment (Scaling Limit fix), default 3000

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only boot when run as the process entry — never on import (so tests importing
// createApp() do not start Vite). Pitfall 2 / Pattern 1.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
