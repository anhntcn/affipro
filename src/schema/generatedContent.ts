import { z } from 'zod';

// Server-side double-guard (D-03): mirrors src/types.ts EXACTLY with snake_case
// keys. The Gemini responseSchema constrains the shape at generation time; this
// Zod schema re-validates the parsed output before it crosses to the client.
//
// scene_number uses z.coerce.number() (Pitfall 4): the model may emit "1" as a
// string, or the responseSchema NUMBER type may drift — coerce keeps a valid
// numeric scene index from failing validation on the video-scenes tab.

export const ProductAnalysisSchema = z.object({
  product_name: z.string(),
  target_audience: z.string(),
  key_benefits: z.array(z.string()),
});

export const FacebookThreadsSchema = z.object({
  hook_headline: z.string(),
  story_or_problem: z.string(),
  product_highlights: z.array(z.string()),
  call_to_action: z.string(),
  hashtags: z.array(z.string()),
});

export const VideoSceneSchema = z.object({
  scene_number: z.coerce.number(),
  time_range: z.string(),
  visual_action: z.string(),
  voiceover: z.string(),
  on_screen_text: z.string(),
});

export const ShortVideoScriptSchema = z.object({
  video_title: z.string(),
  estimated_duration: z.string(),
  scenes: z.array(VideoSceneSchema),
});

export const GeneratedContentSchema = z.object({
  product_analysis: ProductAnalysisSchema,
  facebook_threads: FacebookThreadsSchema,
  short_video_script: ShortVideoScriptSchema,
  instant_deal_telegram_zalo: z.string(),
});

export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;
