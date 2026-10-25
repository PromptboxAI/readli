/**
 * Meta Pixel for Facebook ads (Kevin, 2026-10-25). It runs only on the public, grown-up pages below and
 * never in Readli Kids, the parent portal, admin, sign-in, invitations or the legal pages a Kids Mode
 * device can still open. Pages are listed one by one so a new page stays pixel-free until it's added.
 * Previews and local builds never load it, and a browser sending Global Privacy Control never loads it.
 * Change this together with "Cookies and analytics" in the Privacy Policy.
 */

export const META_PIXEL_ID = "28060840410257774";

/** Public marketing pages, and everything under them. */
const PAGE_PREFIXES = ["/try", "/pricing", "/books", "/parents", "/help", "/company", "/signup", "/grandparents"];
/** Single pages: the homepage, buying a gift, and Plan and billing (only for the checkout events). */
const PAGES = ["/", "/gift", "/family/billing"];

export function pixelAllowed(path: string): boolean {
  if (PAGES.includes(path)) return true;
  return PAGE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Production only, so previews and local testing don't add to the ad data. */
export function pixelEnabled(env: Record<string, string | undefined> = { VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV, NODE_ENV: process.env.NODE_ENV }): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return false;
}

export type MetaEvent = "PageView" | "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Subscribe";
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; disablePushState?: boolean };
type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq; navigator: Navigator & { globalPrivacyControl?: boolean } };

/** Whether this browser, on this page, may load or send to the pixel. */
function mayTrack(w: PixelWindow): boolean {
  return pixelEnabled() && !w.navigator.globalPrivacyControl && pixelAllowed(w.location.pathname);
}

/**
 * Meta's base code, minus the automatic PageView. History tracking is off so client-side moves into
 * the parent portal or Readli Kids send nothing, and automatic button and form scanning is off.
 */
export function loadPixel(w: PixelWindow = window as PixelWindow): boolean {
  if (!mayTrack(w)) return false;
  if (w.fbq) return true;
  const n: Fbq = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue!.push(args);
  } as Fbq;
  w.fbq = n;
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  n.disablePushState = true;
  const t = w.document.createElement("script");
  t.async = true;
  t.src = "https://connect.facebook.net/en_US/fbevents.js";
  w.document.head.appendChild(t);
  n("set", "autoConfig", false, META_PIXEL_ID);
  n("init", META_PIXEL_ID);
  return true;
}

/** Sends a standard event. Does nothing off the allowed pages, on previews, or with Global Privacy Control. */
export function trackMeta(event: MetaEvent, params?: Record<string, string | number>, w: PixelWindow = window as PixelWindow): void {
  if (!loadPixel(w)) return;
  if (params) w.fbq!("track", event, params);
  else w.fbq!("track", event);
}

/** Checkout leaves the site for Stripe; the value waits here so the thank-you page can report it once. */
const CHECKOUT_KEY = "readli_meta_checkout";

export function rememberCheckout(valueCents: number): void {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, String(valueCents));
  } catch {}
}

/** The value of the checkout this tab started, once; null if there wasn't one or it was already reported. */
export function takeCheckout(): number | null {
  try {
    const v = sessionStorage.getItem(CHECKOUT_KEY);
    sessionStorage.removeItem(CHECKOUT_KEY);
    return v === null || !Number.isFinite(Number(v)) ? null : Number(v);
  } catch {
    return null;
  }
}
