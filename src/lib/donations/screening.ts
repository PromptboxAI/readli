import type { ValidDonation } from "./program";

/**
 * Basic automatic checks on a donation request (Phase 1). They never approve or reject anything on
 * their own: each one is a note for the reviewer, shown on the request in the admin portal. A PTA
 * without an EIN, or without a website of its own, is normal and is never flagged just for that.
 */
export interface Flag {
  code: string;
  text: string;
}

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com",
  "me.com", "mac.com", "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "protonmail.com", "proton.me", "gmx.com", "mail.com",
  "zoho.com", "yandex.com", "optonline.net", "cox.net", "charter.net", "earthlink.net",
]);
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at"]);
const BULK_WORDS = /\b(bulk|resell|resale|re-sell|wholesale|\d{2,}\s*(codes|memberships|certificates)|multiple (codes|memberships|certificates)|several (codes|memberships|certificates))\b/i;

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").replace(/\b(the|of|and|inc|annual)\b/g, " ").replace(/\s+/g, " ").trim();

/** The same event however it's typed: organization, event name and date. */
export function eventKey(v: Pick<ValidDonation, "orgName" | "eventName" | "eventDate">): string {
  return `${norm(v.orgName)}|${norm(v.eventName)}|${v.eventDate}`.slice(0, 400);
}

export const emailDomain = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";
const hostOf = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};
/** "mail.oakstreet.k12.ny.us" and "oakstreet.k12.ny.us" belong together. */
const sameSite = (a: string, b: string) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

export function isOfficialEmail(email: string, website: string | null): boolean {
  const domain = emailDomain(email);
  const host = hostOf(website);
  if (host && sameSite(domain, host)) return true;
  return /\.(edu|k12\.[a-z]{2}\.us|gov|org)$/.test(domain) && !FREE_MAIL.has(domain);
}

/** Earlier requests that look related, as the screening needs them. */
export interface PriorRequest {
  id: string;
  status: string;
  eventKey: string;
  orgName: string;
  eventDate: string;
  contactEmail: string;
  createdAt: string;
}

export function screen(v: ValidDonation, prior: PriorRequest[], at = new Date()): Flag[] {
  const flags: Flag[] = [];
  const domain = emailDomain(v.contactEmail);
  if (FREE_MAIL.has(domain) && !isOfficialEmail(v.contactEmail, v.orgWebsite)) {
    flags.push({ code: "personal_email", text: `Applied from a personal email address (${domain}). Confirm they can act for the organization.` });
  }
  if (!v.orgWebsite) flags.push({ code: "no_website", text: "No website link in their description. Check what they wrote, or ask for a link." });
  for (const [what, url] of [["website", v.orgWebsite], ["event link", v.eventUrl]] as const) {
    const host = hostOf(url);
    if (host && SHORTENERS.has(host)) flags.push({ code: "short_link", text: `The ${what} is a shortened link (${host}). Open it with care.` });
  }
  if (BULK_WORDS.test(`${v.notes ?? ""} ${v.orgProof ?? ""}`)) {
    flags.push({ code: "bulk_terms", text: "The notes mention bulk codes, resale or several memberships. One certificate per event is standard." });
  }

  const key = eventKey(v);
  const live = prior.filter((p) => p.status !== "rejected");
  const sameEvent = live.filter((p) => p.eventKey === key);
  if (sameEvent.some((p) => p.status === "approved")) flags.push({ code: "already_donated", text: "This event already has an approved donation." });
  else if (sameEvent.length) flags.push({ code: "duplicate_event", text: `Another request for this same event is already in (${sameEvent.length}).` });
  const orgNorm = norm(v.orgName);
  const sameDay = live.filter((p) => p.eventKey !== key && norm(p.orgName) === orgNorm && p.eventDate === v.eventDate);
  if (sameDay.length) flags.push({ code: "overlapping_event", text: "The same organization has another request for an event on the same day." });
  const monthAgo = at.getTime() - 30 * 86_400_000;
  const fromContact = prior.filter((p) => p.contactEmail === v.contactEmail && new Date(p.createdAt).getTime() > monthAgo);
  const otherOrgs = new Set(fromContact.map((p) => norm(p.orgName)).filter((o) => o !== orgNorm));
  if (otherOrgs.size) flags.push({ code: "contact_many_orgs", text: `This email applied for ${otherOrgs.size + 1} different organizations in the last 30 days.` });
  if (fromContact.length >= 3) flags.push({ code: "contact_many_requests", text: `This email sent ${fromContact.length + 1} requests in the last 30 days.` });
  return flags;
}
