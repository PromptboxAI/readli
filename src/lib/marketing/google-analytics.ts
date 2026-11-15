import { adsOptedOut, pixelAllowed, pixelEnabled } from "./meta-pixel";

/**
 * Google Analytics 4 for site traffic (Kevin, 2026-11-15). It follows the Meta Pixel's rules exactly:
 * the same public grown-up pages, production only, and off for a visitor who opted out on
 * /privacy/choices or whose browser sends Global Privacy Control. Google signals and ad
 * personalization are off. Change this together with "Cookies and analytics" in the Privacy Policy.
 */
export const GA_MEASUREMENT_ID = "G-00275HX219";

type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag; navigator: Navigator & { globalPrivacyControl?: boolean } } & Record<string, unknown>;

/** Google's own switch: while it's true, gtag sends nothing, including enhanced-measurement events. */
const DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`;

function mayTrack(w: GaWindow): boolean {
  return pixelEnabled() && pixelAllowed(w.location.pathname) && !adsOptedOut(w);
}

/**
 * Called on every page change. Off the allowed pages (or after an opt-out) it switches an
 * already-loaded tag off, so moving into the parent portal or Readli Kids sends nothing.
 * On an allowed page it loads gtag.js once and sends one page view.
 */
export function trackGaPageView(w: GaWindow = window as unknown as GaWindow): boolean {
  const allowed = mayTrack(w);
  w[DISABLE_KEY] = !allowed;
  if (!allowed) return false;
  if (!w.gtag) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      // gtag.js reads the arguments object itself, as in Google's snippet.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    const s = w.document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    w.document.head.appendChild(s);
    w.gtag("js", new Date());
    w.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  }
  w.gtag("event", "page_view", { page_location: w.location.origin + w.location.pathname + w.location.search, page_title: w.document.title });
  return true;
}

/**
 * The conversion events Readli sends to GA4 (SEO brief, Phase 4). Mark demo_complete, sign_up and purchase
 * as key events in GA (Admin → Events). sign_up comes from the server (lib/server/ga-measurement), since
 * a confirmed account lands on a page GA doesn't run on.
 */
export type GaEvent = "demo_start" | "demo_complete" | "sign_up_start" | "begin_checkout" | "purchase";

/**
 * Sends one event, under the same rules as page views: an allowed page, production, no opt-out. It only
 * uses a tag the page view already loaded, so it never loads GA on its own.
 */
export function trackGaEvent(event: GaEvent, params?: Record<string, string | number>, w: GaWindow = window as unknown as GaWindow): boolean {
  if (!mayTrack(w) || !w.gtag) return false;
  w.gtag("event", event, params ?? {});
  return true;
}

/** Stops a loaded tag at once when the visitor opts out on /privacy/choices. */
export function stopGa(w: GaWindow = window as unknown as GaWindow): void {
  w[DISABLE_KEY] = true;
}
