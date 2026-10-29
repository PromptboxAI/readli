/**
 * Meta Pixel for Facebook ads (Kevin, 2026-10-25). It runs only on the public, grown-up pages below and
 * never in Readli Kids, the parent portal, admin, sign-in, invitations or the legal pages a Kids Mode
 * device can still open. Pages are listed one by one so a new page stays pixel-free until it's added.
 * Previews and local builds never load it, nor does a browser that sends Global Privacy Control or whose
 * visitor chose "Do Not Sell or Share" on /privacy/choices.
 * Conversion events carry an event_id the server's Conversions API copy reuses (lib/server/meta-capi),
 * so Meta counts each action once. Change this together with "Cookies and analytics" in the Privacy Policy.
 */

export const META_PIXEL_ID = "28060840410257774";

/** Public marketing pages, and everything under them. */
const PAGE_PREFIXES = ["/try", "/pricing", "/books", "/parents", "/help", "/company", "/signup", "/grandparents"];
/** Single pages: the homepage, buying a gift, and Plan and billing (only for the checkout events). */
const PAGES = ["/", "/gift", "/family/settings/plan"];

export function pixelAllowed(path: string): boolean {
  if (PAGES.includes(path)) return true;
  return PAGE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Production only, so previews and local testing don't add to the ad data. A preview can turn it on
 * with NEXT_PUBLIC_META_TEST=1 to check events in Events Manager's Test Events tab.
 */
export function pixelEnabled(env: Record<string, string | undefined> = { VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV, META_TEST: process.env.NEXT_PUBLIC_META_TEST }): boolean {
  return env.VERCEL_ENV === "production" || env.META_TEST === "1";
}

export type MetaEvent = "PageView" | "Lead" | "InitiateCheckout" | "Subscribe";
/** Custom events. SignupStarted is the sign-in link being sent; the confirmed account is the server's CompleteRegistration. */
export type MetaCustomEvent = "SignupStarted";
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; disablePushState?: boolean };
type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq; navigator: Navigator & { globalPrivacyControl?: boolean } };

/**
 * The "Do Not Sell or Share" choice, kept in this browser: in storage, and in a cookie of the same name
 * so the server's Conversions API events honour it too.
 */
const OPT_OUT_KEY = "readli_ads_opt_out";

function setOptOutCookie(w: PixelWindow, optOut: boolean): void {
  try {
    w.document.cookie = optOut ? `${OPT_OUT_KEY}=1; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax` : `${OPT_OUT_KEY}=; path=/; max-age=0; samesite=lax`;
  } catch {}
}

export function adsOptedOut(w: PixelWindow = window as PixelWindow): boolean {
  if (w.navigator.globalPrivacyControl) return true;
  try {
    if (w.document.cookie.split(";").some((c) => c.trim() === `${OPT_OUT_KEY}=1`)) return true;
    return w.localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Saves the visitor's choice; opting out also tells an already-loaded pixel to stop. */
export function setAdsOptOut(optOut: boolean, w: PixelWindow = window as PixelWindow): void {
  try {
    if (optOut) w.localStorage.setItem(OPT_OUT_KEY, "1");
    else w.localStorage.removeItem(OPT_OUT_KEY);
  } catch {}
  setOptOutCookie(w, optOut);
  if (optOut) w.fbq?.("consent", "revoke");
}

/** Opt-outs saved before the cookie existed (storage only) get the cookie, so the server sees them. */
export function syncAdsOptOut(w: PixelWindow = window as PixelWindow): void {
  try {
    if (w.localStorage.getItem(OPT_OUT_KEY) === "1") setOptOutCookie(w, true);
  } catch {}
}

/** Whether this browser, on this page, may load or send to the pixel. */
function mayTrack(w: PixelWindow): boolean {
  return pixelEnabled() && pixelAllowed(w.location.pathname) && !adsOptedOut(w);
}

/**
 * Meta's base code, verbatim apart from types, minus its automatic PageView: the stub queues calls as
 * `arguments` until fbevents.js takes over through callMethod. History tracking is off so client-side
 * moves into the parent portal or Readli Kids send nothing, and automatic button and form scanning is off.
 */
export function loadPixel(w: PixelWindow = window as PixelWindow): boolean {
  if (!mayTrack(w)) return false;
  if (w.fbq) return true;
  /* eslint-disable prefer-rest-params, prefer-spread, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = !0;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    if (s?.parentNode) s.parentNode.insertBefore(t, s);
    else b.head.appendChild(t);
  })(w, w.document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable prefer-rest-params, prefer-spread, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions */
  w.fbq!.disablePushState = true;
  w.fbq!("set", "autoConfig", false, META_PIXEL_ID);
  w.fbq!("init", META_PIXEL_ID);
  return true;
}

/**
 * A fresh event_id for an action both the pixel and the server report, or null where the pixel may not
 * run (then the server leaves the pixel-page events alone too).
 */
export function newMetaEventId(w: PixelWindow = window as PixelWindow): string | null {
  if (!mayTrack(w)) return null;
  return w.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Sends a standard event. Does nothing off the allowed pages, on previews, or after an opt-out. */
export function trackMeta(event: MetaEvent, params?: Record<string, string | number>, eventId?: string | null, w: PixelWindow = window as PixelWindow): void {
  if (!loadPixel(w)) return;
  const args: unknown[] = ["track", event];
  if (params || eventId) args.push(params ?? {});
  if (eventId) args.push({ eventID: eventId });
  w.fbq!(...args);
}

export function trackMetaCustom(event: MetaCustomEvent, params?: Record<string, string | number>, w: PixelWindow = window as PixelWindow): void {
  if (!loadPixel(w)) return;
  if (params) w.fbq!("trackCustom", event, params);
  else w.fbq!("trackCustom", event);
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
