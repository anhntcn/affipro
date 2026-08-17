import { GoogleGenAI } from "@google/genai";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to generate affiliate content
  app.post("/api/generate", async (req, res) => {
    try {
      const { productInfo, affiliateLink } = req.body;

      if (!productInfo || !affiliateLink) {
        return res.status(400).json({ error: "Missing productInfo or affiliateLink" });
      }

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

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) {
          throw new Error("No response from Gemini");
      }
      
      const jsonResponse = JSON.parse(text);
      res.json(jsonResponse);

    } catch (error: any) {
      console.error("Error generating content:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

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

startServer();
