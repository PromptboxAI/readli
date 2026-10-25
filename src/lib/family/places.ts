/**
 * Saved listening places: when a place was heard decides which save wins, so a save that arrives late
 * (out of order, retried, or sent after time offline) never moves a listener back over a newer one.
 */

/** How long a device may hold a place before sending it; older times are treated as this old. */
const OLDEST_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * When a place was heard, on the server's clock. The device sends when the listener reached the place
 * and when it sent the save, both on its own clock; their difference is how long ago the place was
 * heard, whatever the device's clock says the time is. A save without them was heard just now.
 */
export function heardAt(device: { listenedAt?: unknown; sentAt?: unknown }, serverNow: Date): string {
  const { listenedAt, sentAt } = device;
  if (typeof listenedAt !== "number" || typeof sentAt !== "number" || !Number.isFinite(listenedAt) || !Number.isFinite(sentAt)) return serverNow.toISOString();
  const ago = Math.min(OLDEST_MS, Math.max(0, sentAt - listenedAt));
  return new Date(serverNow.getTime() - ago).toISOString();
}

/** True when a place heard at `incoming` should replace the saved one heard at `saved`. */
export function isNewer(incoming: string, saved: string | null | undefined): boolean {
  return !saved || Date.parse(incoming) >= Date.parse(saved);
}
