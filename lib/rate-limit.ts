type RateLimitEntry = { count: number; resetAt: number };

const requests = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 20);

export function checkRateLimit(identifier: string) {
  const now = Date.now();
  const existing = requests.get(identifier);

  if (!existing || existing.resetAt <= now) {
    requests.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
