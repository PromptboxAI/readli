import { createHash } from "node:crypto";

/** Names one voice + book pair without exposing the provider voice id. */
export function previewKey(providerVoiceId: string, slug: string): string {
  return `${createHash("sha256").update(providerVoiceId).digest("hex").slice(0, 16)}-${slug}`;
}
