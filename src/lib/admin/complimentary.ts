import type { SupabaseClient } from "@supabase/supabase-js";
import { generateGiftCode, hashGiftCode } from "@/lib/gifting/codes.server";
import type { AdminUser } from "./access";
import { COMPLIMENTARY_KINDS, MAX_CODES_PER_BATCH } from "./complimentary-kinds";
import { AdminActionError } from "./tester-plans";

/**
 * Complimentary annual Readli Family memberships for schools, charities, fundraisers and promotional
 * giveaways (Kevin, 2026-10-11). Each is a free 12-month gift code: the family opens it like any gift,
 * enters no card and never converts to paid. Redeemed codes become "donated" memberships, with the
 * same narrator slots and monthly credits as a paid plan. They work while gift checkout is still off.
 */
export interface ComplimentaryRequest {
  organization: string;
  kind: string;
  count: number;
  message?: string;
}

export function giftLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/gift/open?code=${encodeURIComponent(code)}`;
}

/** Creates the codes and returns them once; only their hashes are stored. */
export async function issueComplimentary(db: SupabaseClient, admin: AdminUser, req: ComplimentaryRequest, at = new Date()): Promise<string[]> {
  const organization = req.organization.trim().slice(0, 120);
  if (!organization) throw new AdminActionError("Name the school, charity or campaign these are for.");
  if (!(COMPLIMENTARY_KINDS as readonly string[]).includes(req.kind)) throw new AdminActionError("Pick what kind of giveaway this is.");
  if (!Number.isInteger(req.count) || req.count < 1 || req.count > MAX_CODES_PER_BATCH) {
    throw new AdminActionError(`Issue between 1 and ${MAX_CODES_PER_BATCH} memberships at a time.`);
  }
  const message = req.message?.trim().slice(0, 300) || null;
  const codes = Array.from({ length: req.count }, () => generateGiftCode());
  const rows = codes.map((code) => ({
    giver_id: admin.id,
    plan_id: "prepaid_12m",
    status: "sent",
    sent_at: at.toISOString(),
    code_hash: hashGiftCode(code),
    recipient_name: "Your family",
    giver_display_name: organization,
    message,
    complimentary_for: req.kind,
  }));
  const { error } = await db.from("gifts").insert(rows);
  if (error) throw new Error(`issue complimentary memberships: ${error.message}`);
  const { error: logError } = await db
    .from("admin_actions")
    .insert({ admin_id: admin.id, admin_email: admin.email, action: "complimentary_issued", detail: { organization, kind: req.kind, count: req.count } });
  if (logError) throw new Error(`log admin action: ${logError.message}`);
  return codes;
}
