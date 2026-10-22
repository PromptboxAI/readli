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
/** A storyteller's photo, shown beside their name in the player. The route itself checks who may see it. */
const KIDS_PHOTO = /^\/api\/people\/[^/]+\/photo$/;

/**
 * Pages a kids device may open. Everything else (the website, the parent portal, admin) goes to the
 * bookshelf, so launching Readli from a home-screen shortcut feels like a kids app: Readli Kids only.
 * Signing in stays open because that's how a grown-up takes the device back; legal pages stay open.
 */
const KIDS_PAGES = ["/kids", "/login", "/auth", "/privacy", "/terms", "/accessibility"];

export type KidsModeVerdict = "allow" | "deny" | "to_kids";

export function kidsModeRoute(path: string): KidsModeVerdict {
  if (path.startsWith("/api/")) {
    return KIDS_API.some((p) => path.startsWith(p)) || KIDS_API_EXACT.includes(path) || KIDS_PHOTO.test(path) ? "allow" : "deny";
  }
  if (path.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(path.slice(path.lastIndexOf("/")))) return "allow";
  return KIDS_PAGES.some((p) => path === p || path.startsWith(`${p}/`)) ? "allow" : "to_kids";
}
