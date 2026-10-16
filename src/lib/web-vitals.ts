export interface WebVitalsPayload {
  website: string;
  url?: string;
  hostname?: string;
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

export interface WebVitalsRecordRequest {
  type: 'performance';
  payload: WebVitalsPayload;
}

/**
 * Normalizes and clamps Web Vitals numbers according to Umami's ingestion schema constraints:
 * - lcp, inp, fcp, ttfb: nonnegative number up to 60000 ms (rounded to integer)
 * - cls: nonnegative number up to 100 (rounded to 3 decimal places)
 */
export function sanitizeWebVitals(metrics: {
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}): Partial<Record<'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb', number>> {
  const result: Partial<Record<'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb', number>> = {};

  const clampMs = (val?: number) => {
    if (val === undefined || Number.isNaN(val)) return undefined;
    return Math.min(Math.max(0, Math.round(val)), 60000);
  };

  const clampScore = (val?: number) => {
    if (val === undefined || Number.isNaN(val)) return undefined;
    const clamped = Math.min(Math.max(0, val), 100);
    return Math.round(clamped * 1000) / 1000;
  };

  if (metrics.lcp !== undefined) result.lcp = clampMs(metrics.lcp);
  if (metrics.inp !== undefined) result.inp = clampMs(metrics.inp);
  if (metrics.cls !== undefined) result.cls = clampScore(metrics.cls);
  if (metrics.fcp !== undefined) result.fcp = clampMs(metrics.fcp);
  if (metrics.ttfb !== undefined) result.ttfb = clampMs(metrics.ttfb);

  return result;
}

/**
 * Builds the performance payload required by Umami's /api/send endpoint.
 */
export function buildWebVitalsPayload({
  websiteId,
  url,
  hostname,
  metrics,
}: {
  websiteId: string;
  url?: string;
  hostname?: string;
  metrics: {
    lcp?: number;
    inp?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
  };
}): WebVitalsRecordRequest {
  const sanitized = sanitizeWebVitals(metrics);

  return {
    type: 'performance',
    payload: {
      website: websiteId,
      url: url || '/',
      hostname: hostname || (typeof window !== 'undefined' ? window.location.hostname : undefined),
      ...sanitized,
    },
  };
}

/**
 * Generates the HTML tracking tag for Umami with Core Web Vitals enabled.
 */
export function getTrackingCode({
  hostUrl,
  websiteId,
  includePerformance = true,
}: {
  hostUrl: string;
  websiteId: string;
  includePerformance?: boolean;
}): string {
  const cleanHost = hostUrl.replace(/\/+$/, '');
  const perfAttr = includePerformance ? ' data-performance="true"' : '';
  return `<script defer src="${cleanHost}/script.js" data-website-id="${websiteId}"${perfAttr}></script>`;
}
