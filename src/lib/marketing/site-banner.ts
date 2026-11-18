import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The slim announcement bar at the top of the public site (Kevin, 2026-11-15). Admins edit it on
 * /admin/banner (the one-row site_banner table). It shows on pages with the public site header, never
 * on a Kids Mode device, in the parent portal, on invitation pages or in admin. Visitors can close it
 * for the rest of their visit.
 */

export const SITE_BANNER_TAG = "site-banner";
export const BANNER_LIMITS = { message: 200, linkText: 40, linkUrl: 300 } as const;

export interface SiteBanner {
  enabled: boolean;
  message: string;
  linkText: string;
  linkUrl: string;
  /** ISO times, or null for no limit. */
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string | null;
}

export const EMPTY_BANNER: SiteBanner = { enabled: false, message: "", linkText: "", linkUrl: "", startsAt: null, endsAt: null, updatedAt: null };

type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : "");
const time = (v: unknown) => (typeof v === "string" && v ? v : null);

export function bannerFromRow(row: Row | null | undefined): SiteBanner {
  if (!row) return EMPTY_BANNER;
  return {
    enabled: row.enabled === true,
    message: text(row.message),
    linkText: text(row.link_text),
    linkUrl: text(row.link_url),
    startsAt: time(row.starts_at),
    endsAt: time(row.ends_at),
    updatedAt: time(row.updated_at),
  };
}

/** A link the bar may use: a page on Readli ("/gifts") or an https address. */
export function safeBannerLink(url: string): string | null {
  const u = url.trim();
  if (/^\/(?!\/)/.test(u)) return u;
  if (/^https:\/\/[^\s/]+\.[^\s]+$/i.test(u)) return u;
  return null;
}

/** On, has a message, and today is inside its dates. */
export function bannerLive(b: SiteBanner, now: Date = new Date()): boolean {
  if (!b.enabled || !b.message.trim()) return false;
  const t = now.getTime();
  if (b.startsAt && t < new Date(b.startsAt).getTime()) return false;
  if (b.endsAt && t >= new Date(b.endsAt).getTime()) return false;
  return true;
}

/** The saved banner, or nothing if Supabase isn't connected or the migration hasn't run. */
export async function readSiteBanner(db: SupabaseClient | null): Promise<SiteBanner> {
  if (!db) return EMPTY_BANNER;
  try {
    const { data, error } = await db.from("site_banner").select("*").eq("id", true).maybeSingle();
    return error ? EMPTY_BANNER : bannerFromRow(data as Row | null);
  } catch {
    return EMPTY_BANNER;
  }
}

/** A Readli-time "YYYY-MM-DD" from the admin form as the start of that day, America/New_York. */
export function dayStart(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const noonUtc = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(noonUtc.getTime())) return null;
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" })
    .formatToParts(noonUtc)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(offset ?? "");
  return new Date(`${day}T00:00:00${m ? `${m[1]}:${m[2] ?? "00"}` : "-05:00"}`).toISOString();
}

/** The Readli-time day ("YYYY-MM-DD") an ISO time falls on, for the admin form. */
export function readliDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type BannerForm = { ok: true; row: Row } | { ok: false; error: string };

/**
 * Checks the admin form. Dates are whole days in Readli's time zone: the bar shows from the start of
 * "Show from" until the end of "Show until".
 */
export function parseBannerForm(form: { get(name: string): unknown }): BannerForm {
  const field = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "").trim();
  const enabled = field("enabled") === "on";
  const message = field("message").replace(/\s+/g, " ");
  const linkText = field("link_text");
  const linkUrl = field("link_url");
  const from = field("starts_on");
  const until = field("ends_on");
  if (message.length > BANNER_LIMITS.message) return { ok: false, error: `Keep the message to ${BANNER_LIMITS.message} characters.` };
  if (linkText.length > BANNER_LIMITS.linkText) return { ok: false, error: `Keep the link text to ${BANNER_LIMITS.linkText} characters.` };
  if (enabled && !message) return { ok: false, error: "Add a message before turning the bar on." };
  if (Boolean(linkText) !== Boolean(linkUrl)) return { ok: false, error: "Give the link both its text and where it goes, or leave both empty." };
  if (linkUrl && (linkUrl.length > BANNER_LIMITS.linkUrl || !safeBannerLink(linkUrl))) return { ok: false, error: "The link must be a Readli page like /gifts, or an address starting with https://." };
  const startsAt = from ? dayStart(from) : null;
  if (from && !startsAt) return { ok: false, error: "\"Show from\" isn't a date." };
  const lastDay = until ? dayStart(until) : null;
  if (until && !lastDay) return { ok: false, error: "\"Show until\" isn't a date." };
  const endsAt = lastDay ? dayStart(new Date(new Date(lastDay).getTime() + 36 * 3600_000).toISOString().slice(0, 10)) : null;
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: "\"Show until\" must be on or after \"Show from\"." };
  return { ok: true, row: { id: true, enabled, message, link_text: linkText, link_url: linkUrl, starts_at: startsAt, ends_at: endsAt } };
}
