/**
 * Rate limit en memoria (por instancia serverless).
 * Suficiente para freír abuso burdo de Nominatim; no es global multi-región.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  const remaining = Math.max(0, opts.limit - b.count);
  if (b.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining, retryAfterSec: 0 };
}

/** Extrae IP best-effort de request headers. */
export function clientIpFromHeaders(headers: Headers): string {
  const xf = headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || 'unknown';
  return headers.get('x-real-ip') || headers.get('cf-connecting-ip') || 'unknown';
}
