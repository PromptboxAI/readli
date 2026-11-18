import { OPT_OUT_KEY } from "@/lib/marketing/meta-pixel";
import { ANDROID_PACKAGE } from "./asset-links";

/** Same-origin requests from inside the Android app carry this header, so purchase routes can refuse them. */
export const IN_APP_HEADER = "x-readli-app";

export const IN_APP_PURCHASE_MESSAGE = "Purchases and plan changes aren't available in the Readli app.";

/**
 * Runs before the page paints. The Android app opens readli.ai with an android-app:// referrer; that tab
 * is remembered in sessionStorage (not a cookie, which Chrome would share with ordinary browsing), marks
 * <html data-app="android"> so purchase buttons hide, and tags same-origin fetches with IN_APP_HEADER.
 * Google Play doesn't allow the app to sell through Stripe, so the server refuses those requests too.
 * The app also saves the "Do Not Sell or Share" opt-out, so the Meta Pixel, Google Analytics and the
 * server's Conversions API and GA events stay off for it (and, since Chrome shares the cookie, for
 * readli.ai in Chrome on that phone too).
 */
export const IN_APP_SCRIPT = `(function(){try{var k="readli_app",s=sessionStorage;if(document.referrer.indexOf("android-app://${ANDROID_PACKAGE}")===0)s.setItem(k,"android");if(s.getItem(k)!=="android")return;document.documentElement.setAttribute("data-app","android");try{localStorage.setItem("${OPT_OUT_KEY}","1")}catch(e){}document.cookie="${OPT_OUT_KEY}=1; path=/; max-age=34560000; samesite=lax";var f=window.fetch;window.fetch=function(i,o){try{var r=typeof Request!=="undefined"&&i instanceof Request;var u=new URL(r?i.url:String(i),location.href);if(u.origin===location.origin){o=Object.assign({},o);var h=new Headers(o.headers||(r?i.headers:undefined));h.set("${IN_APP_HEADER}","android");o.headers=h}}catch(e){}return f.call(this,i,o)}}catch(e){}})();`;

export function fromAndroidApp(req: Request): boolean {
  return req.headers.get(IN_APP_HEADER) === "android";
}
