import { GA_MEASUREMENT_ID } from "@/lib/marketing/google-analytics";
import { requestOptedOut } from "./meta-capi";

/**
 * GA4 Measurement Protocol (SEO brief, Phase 4): the confirmed account (sign_up), which happens on the
 * sign-in callback where GA's tag never runs. It is tied to the visitor's existing GA session through the
 * _ga cookie GA set on the public pages, and nothing else is sent: no email, no Readli id.
 * Skipped when that cookie is missing (GA never ran, or was blocked), when the browser opted out on
 * /privacy/choices or sends Global Privacy Control, outside production, and until GA_API_SECRET is set
 * (GA Admin → Data streams → the readli.ai stream → Measurement Protocol API secrets).
 */

type Env = Record<string, string | undefined>;

/** "GA1.1.123456789.1700000000" → "123456789.1700000000", GA's client id. */
export function gaClientId(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k !== "_ga") continue;
    const m = /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(decodeURIComponent(v.join("=")));
    return m ? m[1]! : null;
  }
  return null;
}

/** Sends one event. Never throws: an analytics outage must not break sign-in. */
export async function sendGaServerEvent(
  req: Request,
  name: "sign_up",
  params: Record<string, string | number>,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.GA_API_SECRET || env.VERCEL_ENV !== "production") return false;
  if (requestOptedOut(req)) return false;
  const clientId = gaClientId(req);
  if (!clientId) return false;
  try {
    const res = await fetchImpl(`https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${encodeURIComponent(env.GA_API_SECRET)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, non_personalized_ads: true, events: [{ name, params }] }),
    });
    return res.ok;
  } catch (err) {
    console.error("GA measurement protocol failed", err);
    return false;
  }
}
