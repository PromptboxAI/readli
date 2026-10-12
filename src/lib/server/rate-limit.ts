/**
 * A small in-memory limiter for bursts from one person or address. Each server instance keeps its
 * own counts, so it slows automated abuse rather than enforcing a quota; quotas live in the database.
 */
const buckets = new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 10_000) for (const k of [...buckets.keys()].slice(0, 5_000)) buckets.delete(k);
  return true;
}

export function clientAddress(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
