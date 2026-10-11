import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGiftCode } from "./codes";
import { hashGiftCode } from "./codes.server";
import { giftPlan, type GiftPlan } from "./plans";

/**
 * Gift redemption for real accounts (gifts, migration 000500). The code is looked up by its hash.
 * Redeeming runs redeem_gift, which gives the recipient's own family (created if they have none) the
 * Readli Family plan for the gift's months, after any time they already have. Recipients never
 * enter a card, and nothing converts to a paid plan when the gift ends.
 */
export class GiftError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface GiftLanding {
  plan: GiftPlan;
  to: string;
  from: string;
  message: string;
  status: "ready" | "redeemed" | "unavailable";
}

const UNCLAIMED_MS = 365 * 86_400_000;

/** What the recipient sees before claiming: the card, never the giver's account or payment. */
export async function giftForCode(db: SupabaseClient, code: string, now = new Date()): Promise<GiftLanding | null> {
  const normalized = normalizeGiftCode(code);
  if (!normalized) return null;
  const { data, error } = await db
    .from("gifts")
    .select("plan_id, status, recipient_name, giver_display_name, message, sent_at, redeemed_at")
    .eq("code_hash", hashGiftCode(normalized))
    .limit(1);
  if (error) throw new Error(`read gift: ${error.message}`);
  const g = (data ?? [])[0] as Record<string, unknown> | undefined;
  const plan = g && giftPlan(g.plan_id as string);
  if (!g || !plan) return null;
  const sentAt = g.sent_at ? new Date(g.sent_at as string) : null;
  const status =
    g.redeemed_at || g.status === "active" || g.status === "ended"
      ? "redeemed"
      : g.status === "sent" && !(sentAt && now.getTime() - sentAt.getTime() > UNCLAIMED_MS)
        ? "ready"
        : "unavailable";
  return { plan, to: g.recipient_name as string, from: g.giver_display_name as string, message: (g.message as string | null) ?? "", status };
}

const REASONS: [RegExp, number, string, string][] = [
  [/gift not found/, 404, "gift_not_found", "We couldn't find that gift code. Check it and try again."],
  [/already redeemed/, 409, "gift_redeemed", "This gift has already been opened."],
  [/cancelled/, 410, "gift_cancelled", "This gift was cancelled, so it can't be opened."],
  [/unclaimed/, 410, "gift_expired", "This gift link has expired. Ask the person who sent it to get in touch with us."],
  [/not ready/, 409, "gift_not_ready", "This gift isn't ready to open yet."],
  [/own gift/, 403, "own_gift", "You can't open a gift you sent. Share the code with the person it's for."],
];

export async function redeemGiftCode(db: SupabaseClient, code: string, user: { id: string; name: string }): Promise<{ householdId: string; paidThrough: string }> {
  const normalized = normalizeGiftCode(code);
  if (!normalized) throw new GiftError(400, "bad_code", "That doesn't look like a gift code. It's 12 letters and numbers, like ABCD-EFGH-JKMN.");
  const { data, error } = await db.rpc("redeem_gift", { p_code_hash: hashGiftCode(normalized), p_user: user.id, p_family_name: `${user.name}'s family` });
  if (error) {
    const hit = REASONS.find(([re]) => re.test(error.message));
    if (hit) throw new GiftError(hit[1], hit[2], hit[3]);
    throw new Error(`redeem gift: ${error.message}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { household_id: string; paid_through: string };
  return { householdId: row.household_id, paidThrough: row.paid_through };
}
