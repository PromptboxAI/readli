import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/**
 * The family-invitation funnel for /admin/invitations, from first-party events and invitation rows.
 * Opens count page visits from a browser; plays count presses of play, the sign of a person. No
 * email address or child appears anywhere in it.
 */
export interface InvitationFunnel {
  days: number;
  voicesCreated: number;
  previewsGenerated: number;
  previewsApproved: number;
  books: { slug: string; previews: number }[];
  invitationsSent: number;
  uniqueRecipients: number;
  pagesOpened: number;
  previewsPlayed: number;
  accepted: number;
  trialsStarted: number;
  converted: number;
  payingHouseholds: number;
  /** Subscriptions and narrator slots paid by attributed households, as a monthly amount in cents. */
  attributedMrrCents: number;
  declined: number;
  reports: number;
}

const distinct = (rows: Row[], key: string) => new Set(rows.map((r) => (r.properties as Row | null)?.[key]).filter(Boolean)).size;

export function funnelFromRows(input: { days: number; events: Row[]; invitations: Row[]; revenue: Row[] }): InvitationFunnel {
  const by = (name: string) => input.events.filter((e) => e.name === name);
  const books = new Map<string, number>();
  for (const e of by("invite_preview_generated")) {
    const slug = (e.properties as Row | null)?.book;
    if (typeof slug === "string") books.set(slug, (books.get(slug) ?? 0) + 1);
  }
  const paying = new Set(input.invitations.filter((i) => i.converted_at && i.household_id).map((i) => i.household_id as string));
  const latest = new Map<string, Row>();
  for (const r of input.revenue) {
    if (!paying.has(r.household_id as string) || (r.kind !== "subscription" && r.kind !== "narrator_slot")) continue;
    const key = `${r.household_id}:${r.kind}`;
    const prev = latest.get(key);
    if (!prev || String(r.occurred_at) > String(prev.occurred_at)) latest.set(key, r);
  }
  const mrr = [...latest.values()].reduce((sum, r) => sum + (r.billing_interval === "year" ? Number(r.amount_cents) / 12 : Number(r.amount_cents)), 0);
  return {
    days: input.days,
    voicesCreated: by("contributor_voice_created").length,
    previewsGenerated: by("invite_preview_generated").length,
    previewsApproved: by("invite_preview_approved").length,
    books: [...books.entries()].map(([slug, previews]) => ({ slug, previews })).sort((a, b) => b.previews - a.previews),
    invitationsSent: input.invitations.length,
    uniqueRecipients: new Set(input.invitations.map((i) => i.recipient_email_hash)).size,
    pagesOpened: distinct(by("invite_landing_viewed"), "invitation_id"),
    previewsPlayed: distinct(by("invite_audio_played"), "invitation_id"),
    accepted: input.invitations.filter((i) => i.accepted_at).length,
    trialsStarted: input.invitations.filter((i) => i.trial_started_at).length,
    converted: input.invitations.filter((i) => i.converted_at).length,
    payingHouseholds: paying.size,
    attributedMrrCents: Math.round(mrr),
    declined: input.invitations.filter((i) => i.declined_at && !i.reported_at).length,
    reports: input.invitations.filter((i) => i.reported_at).length,
  };
}

const NAMES = [
  "contributor_voice_created",
  "invite_preview_generated",
  "invite_preview_approved",
  "invite_landing_viewed",
  "invite_audio_played",
];

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

export async function loadInvitationFunnel(db: SupabaseClient, days = 90, now = new Date()): Promise<InvitationFunnel> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const [events, invitations] = await Promise.all([
    rows(db.from("analytics_events").select("name, properties").in("name", NAMES).gte("occurred_at", since).limit(50_000), "read events"),
    rows(
      db.from("voice_invitations").select("recipient_email_hash, household_id, accepted_at, trial_started_at, converted_at, declined_at, reported_at").gte("created_at", since).limit(50_000),
      "read invitations",
    ),
  ]);
  const households = [...new Set(invitations.filter((i) => i.converted_at && i.household_id).map((i) => i.household_id as string))];
  const revenue = households.length
    ? await rows(db.from("revenue_events").select("household_id, kind, amount_cents, billing_interval, occurred_at").in("household_id", households).eq("livemode", true), "read revenue")
    : [];
  return funnelFromRows({ days, events, invitations, revenue });
}

export interface InvitationReport {
  id: string;
  reason: string;
  details: string;
  createdAt: string;
  contributorId: string | null;
}

export async function openReports(db: SupabaseClient): Promise<InvitationReport[]> {
  const list = await rows(db.from("voice_invitation_reports").select("*").is("reviewed_at", null).order("created_at", { ascending: false }).limit(50), "read reports");
  return list.map((r) => ({ id: r.id as string, reason: r.reason as string, details: (r.details as string | null) ?? "", createdAt: r.created_at as string, contributorId: (r.contributor_id as string | null) ?? null }));
}
