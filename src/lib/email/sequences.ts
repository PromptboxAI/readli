import type { SupabaseClient } from "@supabase/supabase-js";
import { effectivePlan } from "@/lib/billing/price-settings";
import { AccountFamilyStore } from "@/lib/family/account-store";
import { activeEntitlement } from "@/lib/family/permissions";
import { creditBalance, displayCredits } from "@/lib/narration/credits";
import { queueEmails, type QueuedEmail } from "./outbox";
import { preferencesUrl, unsubscribeHeaders } from "./preferences";
import { storytellerHeadsUps } from "./reminders";
import { readliEmail } from "./templates";

/**
 * Finds who is due each launch email in the sequence matrix and queues it. Runs hourly before the
 * outbox sends. Only emails switched on in /admin are looked for, each within a short window after
 * its trigger, so switching one on never mails people who signed up weeks ago. Each email's dedupe
 * key means a person gets it once; the outbox checks consent and limits again when it sends.
 *
 * Readli Family emails (F) go to the grown-up who created a household. Readli Voice emails (C) go to
 * contributors who signed up for a free voice and have no household of their own; they never
 * mention plans, trials or prices (Kevin, 2026-10-24, point 2).
 */

type Row = Record<string, unknown>;

export interface SequenceContext {
  db: SupabaseClient;
  secret: string;
  base: string;
  now: Date;
  enabled: Set<string>;
}

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

async function firstNames(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await q(db.from("adult_profiles").select("user_id, display_name").in("user_id", ids), "read names");
  return new Map(rows.map((r) => [r.user_id as string, String(r.display_name ?? "").trim().split(/\s+/)[0] ?? ""]));
}

/** Owners with a voice kept or being prepared. */
async function voiceOwners(db: SupabaseClient, ids: string[]): Promise<Map<string, Row[]>> {
  const out = new Map<string, Row[]>();
  if (!ids.length) return out;
  const rows = await q(db.from("voice_profiles").select("id, owner_id, status").in("owner_id", ids).in("status", ["processing", "ready"]).is("deleted_at", null), "read voices");
  for (const r of rows) out.set(r.owner_id as string, [...(out.get(r.owner_id as string) ?? []), r]);
  return out;
}

/** Users who look after a household of their own: they get Family email, never Readli Voice email. */
async function guardians(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await q(db.from("household_members").select("user_id").in("user_id", ids).eq("role", "guardian").is("removed_at", null), "read guardians");
  return new Set(rows.map((r) => r.user_id as string));
}

async function alreadyQueued(db: SupabaseClient, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const rows = await q(db.from("email_outbox").select("dedupe_key").in("dedupe_key", keys), "read queued email");
  return new Set(rows.map((r) => r.dedupe_key as string));
}

interface Household {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

/** Households created in the window whose creator still looks after them. */
async function newHouseholds(db: SupabaseClient, now: Date, fromMs: number, toMs: number): Promise<Household[]> {
  const rows = await q(db.from("households").select("id, name, created_by, created_at").gte("created_at", ago(now, toMs)).lte("created_at", ago(now, fromMs)), "read households");
  const withOwner = rows.filter((r) => typeof r.created_by === "string");
  if (!withOwner.length) return [];
  const members = await q(
    db.from("household_members").select("household_id, user_id").in("household_id", withOwner.map((r) => r.id as string)).eq("role", "guardian").is("removed_at", null),
    "read household guardians",
  );
  const kept = new Set(members.map((m) => `${m.household_id}:${m.user_id}`));
  return withOwner
    .filter((r) => kept.has(`${r.id}:${r.created_by}`))
    .map((r) => ({ id: r.id as string, name: String(r.name ?? "your family"), ownerId: r.created_by as string, createdAt: r.created_at as string }));
}

/** The plan line and credit balance for the welcome email, read from the ledger, never typed in. */
async function planSummary(db: SupabaseClient, h: Household, name: string, now: Date): Promise<string | null> {
  try {
    const plan = await effectivePlan(db);
    const state = await new AccountFamilyStore(db, { id: h.ownerId, name: name || "Grown-up" }, plan).read();
    const at = now.toISOString();
    const e = activeEntitlement(state, h.id, at);
    if (!e) return "When you're ready, choose a plan in Billing to start making narration.";
    const b = creditBalance(state, plan, h.id, at);
    const credits = displayCredits(b.available, b.unitsPerCredit);
    const creditText = `${credits.toLocaleString("en-US")} narration ${credits === 1 ? "credit" : "credits"}`;
    if (e.source === "trial") return `Your free trial runs until ${e.endsAt ? day(e.endsAt) : "it ends"}, and you have ${creditText} to use while it lasts.`;
    return `Your Readli Family plan is active${e.endsAt ? ` until ${day(e.endsAt)}` : ""}, and you have ${creditText} right now.`;
  } catch (err) {
    console.error("welcome plan summary failed", h.id, err);
    return null;
  }
}

function familyMessage(ctx: SequenceContext, userId: string, name: string, kind: "transactional" | "setup", m: { subject: string; title: string; paragraphs: string[]; cta: string; path: string }) {
  const optional = kind === "setup";
  return readliEmail({
    subject: m.subject,
    name,
    title: m.title,
    paragraphs: m.paragraphs,
    cta: { label: m.cta, url: `${ctx.base}${m.path}` },
    reason: optional ? "You're getting this because you're setting up Readli Family." : "You're getting this because you started Readli Family.",
    preferencesUrl: preferencesUrl(ctx.base, ctx.secret, userId),
    headers: optional ? unsubscribeHeaders(ctx.base, ctx.secret, userId, "setup_reminders") : undefined,
    stopLabel: optional ? "Stop setup reminders" : undefined,
  });
}

function voiceMessage(ctx: SequenceContext, userId: string, name: string, kind: "transactional" | "setup", m: { subject: string; title: string; paragraphs: string[]; cta: string; path: string }) {
  const optional = kind === "setup";
  return readliEmail({
    subject: m.subject,
    name,
    title: m.title,
    paragraphs: m.paragraphs,
    cta: { label: m.cta, url: `${ctx.base}${m.path}` },
    reason: "You're getting this because you made a free Readli Voice account.",
    preferencesUrl: preferencesUrl(ctx.base, ctx.secret, userId),
    headers: optional ? unsubscribeHeaders(ctx.base, ctx.secret, userId, "setup_reminders") : undefined,
    stopLabel: optional ? "Stop setup reminders" : undefined,
  });
}

/** F1: welcome, right after a household is created. */
async function familyWelcome(ctx: SequenceContext): Promise<QueuedEmail[]> {
  const homes = await newHouseholds(ctx.db, ctx.now, 0, DAY);
  const done = await alreadyQueued(ctx.db, homes.map((h) => `F1:${h.id}`));
  const due = homes.filter((h) => !done.has(`F1:${h.id}`));
  const names = await firstNames(ctx.db, due.map((h) => h.ownerId));
  const out: QueuedEmail[] = [];
  for (const h of due) {
    const name = names.get(h.ownerId) ?? "";
    const plan = await planSummary(ctx.db, h, name, ctx.now);
    out.push({
      emailId: "F1",
      dedupeKey: `F1:${h.id}`,
      to: { userId: h.ownerId },
      householdId: h.id,
      message: familyMessage(ctx, h.ownerId, name, "transactional", {
        subject: "Welcome to Readli Family",
        title: `${h.name} is ready for bedtime stories`,
        paragraphs: [
          ...(plan ? [plan] : []),
          "Three things make Readli feel like home: record your own voice, invite a grandparent or another storyteller, and set up your kids' tablet.",
        ],
        cta: "Open Readli",
        path: "/family",
      }),
    });
  }
  return out;
}

/** F2, F4, F5: one setup nudge each, skipped once that step is done, none after day 10. */
async function familySetup(ctx: SequenceContext): Promise<QueuedEmail[]> {
  const homes = await newHouseholds(ctx.db, ctx.now, 1 * DAY, 10 * DAY);
  if (!homes.length) return [];
  const age = (h: Household) => ctx.now.getTime() - new Date(h.createdAt).getTime();
  const ids = homes.map((h) => h.id);
  const [voices, invites, members, devices, names] = await Promise.all([
    voiceOwners(ctx.db, homes.map((h) => h.ownerId)),
    q(ctx.db.from("household_invitations").select("household_id").in("household_id", ids), "read invitations"),
    q(ctx.db.from("household_members").select("household_id, user_id").in("household_id", ids).is("removed_at", null), "read members"),
    q(ctx.db.from("kids_devices").select("household_id").in("household_id", ids), "read kids devices"),
    firstNames(ctx.db, homes.map((h) => h.ownerId)),
  ]);
  const invited = new Set(invites.map((r) => r.household_id as string));
  const withDevice = new Set(devices.map((r) => r.household_id as string));
  const out: QueuedEmail[] = [];
  for (const h of homes) {
    const name = names.get(h.ownerId) ?? "";
    const others = members.some((m) => m.household_id === h.id && m.user_id !== h.ownerId);
    if (ctx.enabled.has("F2") && !voices.has(h.ownerId)) {
      out.push({
        emailId: "F2",
        dedupeKey: `F2:${h.id}`,
        to: { userId: h.ownerId },
        householdId: h.id,
        message: familyMessage(ctx, h.ownerId, name, "setup", {
          subject: "Three minutes to a lifetime of bedtime stories",
          title: "Record your voice for your kids",
          paragraphs: ["Read a short passage aloud once, and Readli can read any book in the library to your kids in your voice. Most people finish in about three minutes."],
          cta: "Record my voice",
          path: "/family/my-voice",
        }),
      });
    }
    if (ctx.enabled.has("F4") && age(h) >= 3 * DAY && !invited.has(h.id) && !others) {
      out.push({
        emailId: "F4",
        dedupeKey: `F4:${h.id}`,
        to: { userId: h.ownerId },
        householdId: h.id,
        message: familyMessage(ctx, h.ownerId, name, "setup", {
          subject: "Who else should read to your kids?",
          title: "Invite a storyteller",
          paragraphs: [
            "Grandparents, aunts and uncles can record their voice for free, from anywhere. You choose which of your kids hear them.",
          ],
          cta: "Invite a storyteller",
          path: "/family/narrators",
        }),
      });
    }
    if (ctx.enabled.has("F5") && age(h) >= 5 * DAY && !withDevice.has(h.id)) {
      out.push({
        emailId: "F5",
        dedupeKey: `F5:${h.id}`,
        to: { userId: h.ownerId },
        householdId: h.id,
        message: familyMessage(ctx, h.ownerId, name, "setup", {
          subject: "Bedtime, without handing over your phone",
          title: "Set up your kids' tablet",
          paragraphs: ["Kids Mode turns a tablet into a Readli bookshelf for your kids, with only the books and storytellers you've chosen. Leaving it needs your PIN."],
          cta: "Set up a kids device",
          path: "/family/devices",
        }),
      });
    }
  }
  return out;
}

/** F3 or C3: a voice has finished preparing. Family owners get F3, contributors C3. */
async function voiceReady(ctx: SequenceContext): Promise<QueuedEmail[]> {
  const rows = await q(ctx.db.from("voice_profiles").select("id, owner_id").eq("status", "ready").is("deleted_at", null).gte("updated_at", ago(ctx.now, 2 * DAY)), "read ready voices");
  if (!rows.length) return [];
  const owners = [...new Set(rows.map((r) => r.owner_id as string))];
  const [family, names] = await Promise.all([guardians(ctx.db, owners), firstNames(ctx.db, owners)]);
  const out: QueuedEmail[] = [];
  for (const r of rows) {
    const userId = r.owner_id as string;
    const name = names.get(userId) ?? "";
    if (family.has(userId)) {
      if (!ctx.enabled.has("F3")) continue;
      out.push({
        emailId: "F3",
        dedupeKey: `F3:${r.id}`,
        to: { userId },
        message: familyMessage(ctx, userId, name, "transactional", {
          subject: "Your voice is ready. Pick tonight's story",
          title: "Your voice is ready",
          paragraphs: ["Choose a book for tonight, and your kids will hear it in your voice."],
          cta: "Choose a book",
          path: "/family/books",
        }),
      });
    } else if (ctx.enabled.has("C3")) {
      out.push({
        emailId: "C3",
        dedupeKey: `C3:${r.id}`,
        to: { userId },
        message: voiceMessage(ctx, userId, name, "transactional", {
          subject: "Your voice is ready",
          title: "Your Readli voice is ready",
          paragraphs: ["Your voice is saved and stays yours. It's shared only with the families you agree to, and you can stop sharing at any time."],
          cta: "See my voice",
          path: "/voice",
        }),
      });
    }
  }
  return out;
}

/** C1, C2, C4: free Readli Voice contributors with no household of their own. */
async function contributorOnboarding(ctx: SequenceContext): Promise<QueuedEmail[]> {
  const signups = await q(
    ctx.db.from("email_signups").select("user_id, intent, created_at").in("intent", ["voice", "voice_invited"]).gte("created_at", ago(ctx.now, 10 * DAY)).lte("created_at", ago(ctx.now, HOUR / 2)),
    "read signups",
  );
  if (!signups.length) return [];
  const ids = signups.map((s) => s.user_id as string);
  const [family, voices, names] = await Promise.all([guardians(ctx.db, ids), voiceOwners(ctx.db, ids), firstNames(ctx.db, ids)]);
  const selfStarted = signups.filter((s) => s.intent === "voice").map((s) => s.user_id as string);
  const voiceOwner = new Map(selfStarted.flatMap((id) => (voices.get(id) ?? []).map((v) => [v.id as string, id] as const)));
  const [shares, sent] = await Promise.all([
    voiceOwner.size ? q(ctx.db.from("voice_household_shares").select("voice_id").in("voice_id", [...voiceOwner.keys()]).is("revoked_at", null), "read shares") : Promise.resolve([] as Row[]),
    selfStarted.length ? q(ctx.db.from("voice_invitations").select("contributor_id").in("contributor_id", selfStarted), "read voice invitations") : Promise.resolve([] as Row[]),
  ]);
  const sharing = new Set(shares.map((r) => voiceOwner.get(r.voice_id as string)).filter(Boolean) as string[]);
  const inviting = new Set(sent.map((r) => r.contributor_id as string));
  const out: QueuedEmail[] = [];
  for (const s of signups) {
    const userId = s.user_id as string;
    if (family.has(userId)) continue;
    const age = ctx.now.getTime() - new Date(s.created_at as string).getTime();
    const name = names.get(userId) ?? "";
    const mine = voices.get(userId) ?? [];
    if (ctx.enabled.has("C1") && age <= DAY) {
      out.push({
        emailId: "C1",
        dedupeKey: `C1:${userId}`,
        to: { userId },
        message: voiceMessage(ctx, userId, name, "transactional", {
          subject: "Welcome to Readli Voice. It's free",
          title: "Welcome to Readli Voice",
          paragraphs: [
            "Readli Voice is free, with no card and nothing to pay. You record your voice once, and the children of the families you choose can hear you read classic books.",
            "Your voice stays yours: it's shared only after you agree, and you can stop sharing at any time.",
          ],
          cta: mine.length ? "See my voice" : "Record my voice",
          path: mine.length ? "/voice" : "/voice/record",
        }),
      });
    }
    if (ctx.enabled.has("C2") && age >= 2 * DAY && !mine.length) {
      out.push({
        emailId: "C2",
        dedupeKey: `C2:${userId}`,
        to: { userId },
        message: voiceMessage(ctx, userId, name, "setup", {
          subject: "Finish recording your voice",
          title: "Pick up where you left off",
          paragraphs: ["Recording takes about three minutes: read a short passage aloud, and you're done. It's free."],
          cta: "Record my voice",
          path: "/voice/record",
        }),
      });
    }
    const ready = mine.some((v) => v.status === "ready");
    if (ctx.enabled.has("C4") && s.intent === "voice" && age >= 4 * DAY && ready && !sharing.has(userId) && !inviting.has(userId)) {
      out.push({
        emailId: "C4",
        dedupeKey: `C4:${userId}`,
        to: { userId },
        message: voiceMessage(ctx, userId, name, "setup", {
          subject: "Share your voice with family",
          title: "Who should hear you read?",
          paragraphs: ["Invite the grown-ups in your family, and their kids can hear stories in your voice. You choose who, and you can stop sharing at any time."],
          cta: "Invite family",
          path: "/voice/invite",
        }),
      });
    }
  }
  return out;
}

const EVALUATORS: { emails: string[]; run: (ctx: SequenceContext) => Promise<QueuedEmail[]> }[] = [
  { emails: ["F1"], run: familyWelcome },
  { emails: ["F2", "F4", "F5"], run: familySetup },
  { emails: ["F3", "C3"], run: voiceReady },
  { emails: ["C1", "C2", "C4"], run: contributorOnboarding },
  { emails: ["I3"], run: storytellerHeadsUps },
];

/** Queues every switched-on launch email that is due. One failing sequence doesn't stop the others. */
export async function scheduleSequenceEmails(ctx: SequenceContext): Promise<{ queued: number; errors: string[] }> {
  let queued = 0;
  const errors: string[] = [];
  for (const e of EVALUATORS) {
    if (!e.emails.some((id) => ctx.enabled.has(id))) continue;
    try {
      const emails = (await e.run(ctx)).filter((m) => ctx.enabled.has(m.emailId));
      queued += (await queueEmails(ctx.db, ctx.secret, emails, ctx.now)).length;
    } catch (err) {
      errors.push(`${e.emails.join("/")}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { queued, errors };
}
