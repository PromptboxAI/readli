/** Authoritative server checks on an uploaded guest take (Amendment 001 F-3). Client QC is advisory only. */

export const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"] as const;

export type ServerQcIssue = "unsupported_type" | "empty" | "too_large" | "too_short" | "too_long";

export interface UploadFacts {
  mimeType: string;
  bytes: number;
  durationMs: number;
}

export interface QcLimits {
  minRecordingMs: number;
  maxRecordingMs: number;
  maxRecordingBytes: number;
}

/** "audio/webm;codecs=opus" → "audio/webm" */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(";")[0]!.trim().toLowerCase();
}

export function checkUpload(facts: UploadFacts, limits: QcLimits): ServerQcIssue[] {
  const issues: ServerQcIssue[] = [];
  if (!(ALLOWED_AUDIO_TYPES as readonly string[]).includes(baseMimeType(facts.mimeType))) issues.push("unsupported_type");
  if (facts.bytes === 0) issues.push("empty");
  if (facts.bytes > limits.maxRecordingBytes) issues.push("too_large");
  if (!Number.isFinite(facts.durationMs) || facts.durationMs < limits.minRecordingMs) issues.push("too_short");
  if (facts.durationMs > limits.maxRecordingMs) issues.push("too_long");
  // A real take at 192kbps is roughly 24 KB per second; far less means silence or a broken file.
  if (facts.bytes > 0 && facts.durationMs > 0 && facts.bytes / (facts.durationMs / 1000) < 1500) issues.push("empty");
  return [...new Set(issues)];
}

export const SERVER_QC_MESSAGES: Record<ServerQcIssue, string> = {
  unsupported_type: "This browser saved the recording in a format we can't use. Try Chrome or Safari.",
  empty: "We couldn't hear anything in that recording. Check your microphone and try again.",
  too_large: "That recording is too large. Try a take of about one to two minutes.",
  too_short: "That take is a little short to make a good voice. Try reading for at least a minute.",
  too_long: "That take is longer than we need. Two minutes is plenty.",
};
