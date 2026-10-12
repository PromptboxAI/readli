/** Sends a recording-flow event for the admin voice-quality dashboard. Fire and forget. */
export function trackVoiceEvent(name: string, properties: Record<string, string | number | boolean | null | string[]> = {}) {
  if (typeof window === "undefined") return;
  void fetch("/api/analytics/voice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, properties }),
    keepalive: true,
  }).catch(() => undefined);
}
