/**
 * MediaRecorder MIME negotiation (Amendment 001 §A: MIME fallback).
 * Chrome/Android/Firefox record Opus in WebM; Safari (macOS and iOS) records
 * AAC in MP4. ElevenLabs accepts both after server-side checks.
 */
export const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export function pickMimeType(isSupported: (type: string) => boolean): string | null {
  for (const type of PREFERRED_MIME_TYPES) {
    if (isSupported(type)) return type;
  }
  return null;
}

export function fileExtension(mimeType: string): string {
  if (mimeType.startsWith("audio/mp4")) return "m4a";
  if (mimeType.startsWith("audio/ogg")) return "ogg";
  return "webm";
}
