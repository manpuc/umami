import { describe, expect, test } from 'vitest';
import { buildWebVitalsPayload, getTrackingCode, sanitizeWebVitals } from './web-vitals';

describe('web-vitals helper', () => {
  test('sanitizes and clamps metric values to schema bounds', () => {
    const raw = {
      lcp: 1250.7,
      inp: -5,
      cls: 0.12345,
      fcp: 70000, // exceeds 60000ms max
      ttfb: 120,
    };

    const sanitized = sanitizeWebVitals(raw);

    expect(sanitized.lcp).toBe(1251);
    expect(sanitized.inp).toBe(0);
    expect(sanitized.cls).toBe(0.123);
    expect(sanitized.fcp).toBe(60000);
    expect(sanitized.ttfb).toBe(120);
  });

  test('builds performance record request correctly', () => {
    const request = buildWebVitalsPayload({
      websiteId: '3c1bf3f4-3011-4a87-a2f0-756184a329fa',
      url: '/blog/post-1',
      hostname: 'example.com',
      metrics: {
        lcp: 2400,
        cls: 0.05,
      },
    });

    expect(request.type).toBe('performance');
    expect(request.payload.website).toBe('3c1bf3f4-3011-4a87-a2f0-756184a329fa');
    expect(request.payload.url).toBe('/blog/post-1');
    expect(request.payload.hostname).toBe('example.com');
    expect(request.payload.lcp).toBe(2400);
    expect(request.payload.cls).toBe(0.05);
  });

  test('generates tracking code with performance enabled', () => {
    const code = getTrackingCode({
      hostUrl: 'https://analytics.example.com',
      websiteId: '12345678-1234-1234-1234-123456789abc',
      includePerformance: true,
    });

    expect(code).toBe(
      '<script defer src="https://analytics.example.com/script.js" data-website-id="12345678-1234-1234-1234-123456789abc" data-performance="true"></script>',
    );
  });
});
