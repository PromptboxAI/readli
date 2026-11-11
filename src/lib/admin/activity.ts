import type { SupabaseClient } from "@supabase/supabase-js";

/** The admin activity log (Kevin, 2026-11-08): every row of admin_actions, with the family's name. */

export interface ActivityEntry {
  id: string;
  at: string;
  adminEmail: string;
  action: string;
  householdId: string | null;
  family: string | null;
  detail: Record<string, unknown>;
}

const LABEL: Record<string, string> = {
  tester_plan_granted: "Gave a tester plan",
  tester_plan_ended: "Ended a tester plan",
  empty_family_removed: "Removed an empty family",
  complimentary_issued: "Issued complimentary memberships",
  complimentary_revoked: "Revoked a complimentary code",
  complimentary_code_revealed: "Revealed a complimentary code",
  complimentary_artwork_downloaded: "Downloaded complimentary artwork",
  complimentary_emailed: "Emailed a complimentary membership",
  complimentary_cancelled: "Cancelled a complimentary membership",
  narration_carried_forward: "Carried prepared audio to today's text",
  narration_prepared_free: "Prepared narration at Readli's cost",
  narration_stopped: "Stopped a preparation",
  narration_resumed: "Resumed a preparation",
  narration_refunded: "Refunded a preparation",
  kids_pin_unlocked: "Cleared a Kids Mode PIN lockout",
  kids_pin_cleared: "Forgot a family's Kids Mode PIN",
  kids_device_signed_out: "Signed out a kids device",
  sign_in_email_sent: "Sent a sign-in email",
  email_confirmed: "Marked an email confirmed",
  email_changed: "Changed a sign-in email",
  credits_taken_back: "Took back promotional credits",
  donation_request_deleted: "Deleted a donation request",
};

/** A readable line for one action, with the details that matter for it. */
export function describeAction(action: string, detail: Record<string, unknown>): string {
  const base = LABEL[action] ?? action.replaceAll("_", " ");
  const bits: string[] = [];
  if (typeof detail.book === "string") bits.push(detail.book.replaceAll("-", " "));
  if (typeof detail.chapter === "number") bits.push(`chapter ${detail.chapter}`);
  if (typeof detail.sentences === "number") bits.push(`${detail.sentences} sentences`);
  if (typeof detail.credits === "number") bits.push(`${detail.credits} credits`);
  if (typeof detail.label === "string") bits.push(`"${detail.label}"`);
  if (typeof detail.from === "string" && typeof detail.to === "string") bits.push(`${detail.from} to ${detail.to}`);
  return bits.length ? `${base} (${bits.join(", ")})` : base;
}

export async function adminActivity(db: SupabaseClient, query = "", limit = 300): Promise<ActivityEntry[]> {
  const { data, error } = await db.from("admin_actions").select("id, created_at, admin_email, action, household_id, detail").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`read admin activity: ${error.message}`);
  const found = (data ?? []) as Record<string, unknown>[];
  const homeIds = [...new Set(found.map((r) => r.household_id).filter((id): id is string => typeof id === "string"))];
  const homes = homeIds.length ? ((await db.from("households").select("id, name").in("id", homeIds)).data ?? []) : [];
  const entries = found.map((r) => ({
    id: String(r.id),
    at: String(r.created_at),
    adminEmail: String(r.admin_email),
    action: String(r.action),
    householdId: typeof r.household_id === "string" ? r.household_id : null,
    family: (homes.find((h) => h.id === r.household_id)?.name as string | undefined) ?? null,
    detail: (r.detail ?? {}) as Record<string, unknown>,
  }));
  const q = query.toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => [e.adminEmail, e.family ?? "", e.action, describeAction(e.action, e.detail)].some((s) => s.toLowerCase().includes(q)));
}
