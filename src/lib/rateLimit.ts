// Simple in-memory rate limiter (fixed window). For production replace with Redis / durable store.
interface Bucket { count: number; reset: number }
const WINDOW_MS = 60_000;
const MAX = 30;
const store: Map<string, Bucket> = (globalThis as any).__RL_STORE__ || new Map();
(globalThis as any).__RL_STORE__ = store;
export interface RateLimitResult { limited: boolean; remaining: number; reset: number; limit: number }
export function rateLimit(key: string, opts?: { limit?: number; windowMs?: number }): RateLimitResult {
  const limit = opts?.limit ?? MAX; const windowMs = opts?.windowMs ?? WINDOW_MS; const now = Date.now();
  const b = store.get(key);
  if (!b || b.reset <= now) { const fresh = { count: 1, reset: now + windowMs }; store.set(key, fresh); return { limited: false, remaining: limit - 1, reset: fresh.reset, limit }; }
  if (b.count >= limit) return { limited: true, remaining: 0, reset: b.reset, limit };
  b.count += 1; return { limited: false, remaining: limit - b.count, reset: b.reset, limit };
}
export function formatRateLimitHeaders(r: RateLimitResult) { return { 'X-RateLimit-Limit': r.limit.toString(), 'X-RateLimit-Remaining': r.remaining.toString(), 'X-RateLimit-Reset': r.reset.toString() }; }
