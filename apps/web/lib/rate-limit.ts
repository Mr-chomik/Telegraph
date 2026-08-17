/**
 * Minimal in-memory sliding-window rate limiter. Sufficient for a small
 * self-hosted deployment (local app runs a single process). Keyed per IP.
 */
class SlidingWindowLimiter {
  private readonly buckets = new Map<string, number[]>();

  /**
   * @returns true if the request is allowed, false if it exceeds the limit.
   */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= limit) {
      this.buckets.set(key, hits);
      return false;
    }
    hits.push(now);
    this.buckets.set(key, hits);
    return true;
  }
}

export const rateLimiter = new SlidingWindowLimiter();

export function requestKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/**
 * Max allowed attempts per window for login/register. Configurable via env
 * (AUTH_RATE_LIMIT) so local development / test suites don't trip it.
 */
export function authRateLimit(): number {
  const fromEnv = Number(process.env.AUTH_RATE_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 20;
}