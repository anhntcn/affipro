export interface ProductAnalysis {
  product_name: string;
  target_audience: string;
  key_benefits: string[];
}

export interface FacebookThreads {
  hook_headline: string;
  story_or_problem: string;
  product_highlights: string[];
  call_to_action: string;
  hashtags: string[];
}

export interface VideoScene {
  scene_number: number;
  time_range: string;
  visual_action: string;
  voiceover: string;
  on_screen_text: string;
}

export interface ShortVideoScript {
  video_title: string;
  estimated_duration: string;
  scenes: VideoScene[];
}

export interface GeneratedContent {
  product_analysis: ProductAnalysis;
  facebook_threads: FacebookThreads;
  short_video_script: ShortVideoScript;
  instant_deal_telegram_zalo: string;
}
