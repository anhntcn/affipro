// @vitest-environment jsdom
// The global vitest env is `node` (vitest.config.ts). Vitest 4 removed
// config-side `environmentMatchGlobs`, so this React render test opts into jsdom
// via the per-file docblock above — it MUST stay the first line, or `document`
// is undefined and @testing-library/react cannot mount, silently killing FIX-04's
// only automated coverage.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ResultDisplay } from '../src/components/ResultDisplay';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useStore } from '../src/store/useStore';
import { GeneratedContent } from '../src/types';

// A GeneratedContent-shaped payload with several arrays deliberately absent
// (key_benefits, product_highlights, hashtags, scenes). String fields stay
// present so tab switching stays exercisable. Cast because the omission is
// intentional (mirrors a malformed server payload — defense in depth).
const missingFieldContent = {
  product_analysis: {
    product_name: 'Sản phẩm thử nghiệm',
    target_audience: 'Người mua Việt',
    // key_benefits omitted
  },
  facebook_threads: {
    hook_headline: 'Tiêu đề hấp dẫn',
    story_or_problem: 'Câu chuyện sản phẩm',
    // product_highlights omitted
    call_to_action: 'Mua ngay',
    // hashtags omitted
  },
  short_video_script: {
    video_title: 'Ý tưởng video',
    estimated_duration: '30s',
    // scenes omitted
  },
  instant_deal_telegram_zalo: 'Tin nhắn deal',
} as unknown as GeneratedContent;

afterEach(() => {
  cleanup();
  useStore.setState({ generatedContent: null, error: null });
});

describe('ResultDisplay resilience', () => {
  it('renders without throwing when array fields are missing', () => {
    useStore.setState({ generatedContent: missingFieldContent, error: null });

    expect(() =>
      render(
        <ErrorBoundary>
          <ResultDisplay />
        </ErrorBoundary>,
      ),
    ).not.toThrow();

    // The heading proves the component mounted rather than white-screening.
    expect(screen.getByText('Kết Quả Nội Dung')).toBeTruthy();
  });

  it('error boundary shows the Vietnamese fallback when a child throws', () => {
    const Boom = (): never => {
      throw new Error('boom');
    };

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Không hiển thị được kết quả')).toBeTruthy();
  });
});
