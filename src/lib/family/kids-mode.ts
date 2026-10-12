/**
 * Kids Mode on a device: the cookie a guardian sets when they open a child's bookshelf, and what that
 * device may reach while it's set. Edge-safe (no Node APIs), so the middleware can use it.
 *
 * The cookie's presence is enough to restrict the device: its signature is checked where it grants
 * anything (the child's own routes), and an unsigned or stale one only ever takes access away.
 */
export const KIDS_COOKIE = "readli_kids_profile";

/** API routes a kids device needs: the child's own bookshelf and player, playback, and leaving. */
const KIDS_API = ["/api/kids/", "/api/narration/audio/"];
const KIDS_API_EXACT = ["/api/family/session"];

/** Grown-up pages a kids device is sent away from. Public pages (home, books, help) stay open. */
const GROWN_UP_PAGES = ["/admin", "/billing", "/voice", "/gift", "/rewards", "/invite", "/signup", "/welcome", "/try", "/r/"];

export type KidsModeVerdict = "allow" | "deny" | "to_kids";

export function kidsModeRoute(path: string): KidsModeVerdict {
  if (path.startsWith("/api/")) {
    return KIDS_API.some((p) => path.startsWith(p)) || KIDS_API_EXACT.includes(path) ? "allow" : "deny";
  }
  // /family itself offers the way out (sign in again); everything under it is for grown-ups.
  if (path.startsWith("/family/")) return "to_kids";
  if (GROWN_UP_PAGES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))) return "to_kids";
  return "allow";
}
