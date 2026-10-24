import type { ByteRange } from "@/lib/narration/storage";

/**
 * The single byte range in a Range header ("bytes=100-" or "bytes=100-199"), or null to send the whole
 * file. Suffix ranges and multiple ranges also get the whole file, which browsers accept.
 */
export function parseRange(header: string | null): ByteRange | null {
  const m = header?.trim().match(/^bytes=(\d+)-(\d*)$/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : null;
  return end !== null && end < start ? null : { start, end };
}

/** Audio as a full or partial response, so phones can seek and resume within long tracks. */
export function audioResponse(object: { audio: ArrayBuffer; contentType: string; size: number }, range: ByteRange | null): Response {
  const headers: Record<string, string> = { "content-type": object.contentType, "cache-control": "private, no-store", "accept-ranges": "bytes" };
  if (!range) return new Response(object.audio, { headers });
  if (range.start >= object.size) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${object.size}` } });
  const end = range.start + object.audio.byteLength - 1;
  return new Response(object.audio, { status: 206, headers: { ...headers, "content-range": `bytes ${range.start}-${end}/${object.size}` } });
}
