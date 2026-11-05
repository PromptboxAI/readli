/**
 * First-touch acquisition: how a grown-up first found Readli (a campaign link, a search engine, a
 * social site, or nothing at all), kept in a first-party cookie until they start a family, then saved
 * once against that family for the admin growth report. Never a click ID itself, a full referring URL,
 * or anything about a child; only which kind of click ID was present and the referring site's host.
 */

export const FIRST_TOUCH_COOKIE = "readli_src";
export const FIRST_TOUCH_DAYS = 90;

export interface FirstTouch {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  /** Which ad click ID was on the landing URL (gclid, fbclid, ...), never its value. */
  clickId: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  /** When the cookie was set. */
  at: string | null;
}

const CLICK_IDS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid", "twclid", "li_fat_id"] as const;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._~\-/ +]/g, "")
    .slice(0, max);
  return s ? s : null;
};

const host = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    return clean(new URL(raw).hostname.replace(/^www\./, ""), 120);
  } catch {
    return null;
  }
};

/** Our own sites never count as a referrer. */
function isOwnHost(h: string, ownHost: string | null): boolean {
  const own = (ownHost ?? "").replace(/^www\./, "").split(":")[0];
  return h === own || h === "readli.ai" || h.endsWith(".readli.ai") || h === "localhost" || h.endsWith(".vercel.app");
}

/**
 * The first touch a page request carries, or null when it carries nothing worth remembering (no
 * campaign tags, no ad click ID and no outside referrer: an ordinary visit or a click within the site).
 */
export function firstTouchFrom(url: URL, referer: string | null, now = new Date()): FirstTouch | null {
  const p = url.searchParams;
  const source = clean(p.get("utm_source"), 80);
  const medium = clean(p.get("utm_medium"), 80);
  const campaign = clean(p.get("utm_campaign"), 120);
  const clickId = CLICK_IDS.find((k) => p.has(k)) ?? null;
  const refHost = host(referer);
  const referrerHost = refHost && !isOwnHost(refHost, url.hostname) ? refHost : null;
  if (!source && !medium && !campaign && !clickId && !referrerHost) return null;
  return { source, medium, campaign, clickId, referrerHost, landingPath: clean(url.pathname, 200), at: now.toISOString() };
}

const KEYS: Record<keyof FirstTouch, string> = { source: "s", medium: "m", campaign: "c", clickId: "k", referrerHost: "r", landingPath: "l", at: "t" };

export function encodeFirstTouch(t: FirstTouch): string {
  const short: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) if (v) short[KEYS[k as keyof FirstTouch]] = v;
  return encodeURIComponent(JSON.stringify(short));
}

/** Reads the cookie back, re-cleaning every value: the browser can send anything. */
export function decodeFirstTouch(raw: string | undefined | null): FirstTouch | null {
  if (!raw || raw.length > 1200) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const at = typeof o.t === "string" && !Number.isNaN(Date.parse(o.t)) ? new Date(o.t).toISOString() : null;
  const clickId = CLICK_IDS.find((k) => k === o.k) ?? null;
  return {
    source: clean(o.s, 80),
    medium: clean(o.m, 80),
    campaign: clean(o.c, 120),
    clickId,
    referrerHost: clean(o.r, 120),
    landingPath: clean(o.l, 200),
    at,
  };
}

/** The household_acquisition row for a new family. A family with no cookie is saved as a direct visit. */
export function acquisitionRow(householdId: string, t: FirstTouch | null) {
  return {
    household_id: householdId,
    source: t?.source ?? null,
    medium: t?.medium ?? null,
    campaign: t?.campaign ?? null,
    click_id: t?.clickId ?? null,
    referrer_host: t?.referrerHost ?? null,
    landing_path: t?.landingPath ?? null,
    first_seen_at: t?.at ?? null,
  };
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|brave|startpage)\./;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t|x|twitter|pinterest|tiktok|reddit|youtube|linkedin|threads|snapchat|nextdoor)\.(com|co|net)$|^l\.facebook\.com$|^lm\.facebook\.com$/;
const PAID_MEDIA = new Set(["cpc", "ppc", "paid", "paid_social", "paidsocial", "paid-social", "ads", "ad", "display", "cpm"]);

export type Channel = "referral" | "storyteller_invite" | "gift" | "paid" | "campaign" | "search" | "social" | "other_site" | "direct" | "unknown";

export const CHANNEL_LABELS: Record<Channel, string> = {
  referral: "Referral link",
  storyteller_invite: "Storyteller invite",
  gift: "Gift or sponsor",
  paid: "Paid ads",
  campaign: "Tagged campaign",
  search: "Search",
  social: "Social (unpaid)",
  other_site: "Another website",
  direct: "Direct",
  unknown: "Before tracking",
};

/**
 * One channel per family. What Readli itself knows (a referral, a storyteller invite, a gift) wins
 * over the cookie; then paid clicks, tagged campaigns, and the referring site. A family with no
 * acquisition row started before tracking shipped.
 */
export function channelFor(f: {
  referred: boolean;
  invited: boolean;
  gifted: boolean;
  acquisition: { source?: unknown; medium?: unknown; campaign?: unknown; click_id?: unknown; referrer_host?: unknown } | null;
}): Channel {
  if (f.referred) return "referral";
  if (f.invited) return "storyteller_invite";
  if (f.gifted) return "gift";
  const a = f.acquisition;
  if (!a) return "unknown";
  const medium = typeof a.medium === "string" ? a.medium : "";
  if (a.click_id || PAID_MEDIA.has(medium)) return "paid";
  if (a.source || a.campaign || medium) return "campaign";
  const h = typeof a.referrer_host === "string" ? a.referrer_host : "";
  if (h && SEARCH.test(h)) return "search";
  if (h && SOCIAL.test(h)) return "social";
  if (h) return "other_site";
  return "direct";
}
