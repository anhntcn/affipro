import { create } from 'zustand';
import { GeneratedContent } from '../types';

interface AppState {
  generatedContent: GeneratedContent | null;
  isLoading: boolean;
  error: string | null;
  generateContent: (productInfo: string, affiliateLink: string) => Promise<void>;
  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  generatedContent: null,
  isLoading: false,
  error: null,
  generateContent: async (productInfo, affiliateLink) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productInfo, affiliateLink }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data: GeneratedContent = await response.json();
      set({ generatedContent: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Có lỗi xảy ra khi tạo nội dung.', isLoading: false });
    }
  },
  reset: () => set({ generatedContent: null, error: null }),
}));
