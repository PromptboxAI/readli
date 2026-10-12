import type { SupabaseClient } from "@supabase/supabase-js";
import { generateGiftCode, hashGiftCode } from "./codes.server";
import { giftPlan } from "./plans";

/** What a gift email needs. The code exists only here and in the email; Readli keeps its hash. */
export interface GiftEmail {
  giftId: string;
  to: string;
  recipientName: string;
  giverName: string;
  message: string;
  planName: string;
  code: string;
}

export interface GiftSender {
  sendGift(email: GiftEmail): Promise<void>;
}

export interface DeliveryResult {
  sent: number;
  failed: number;
}

/**
 * Sends paid gifts whose delivery date has come. Each gift gets its code at this moment: the hash is
 * saved and the gift marked sent before the email goes out, so two runs can't send one gift twice.
 * If the email fails, the gift goes back to scheduled and the next run makes a fresh code.
 */
export async function deliverDueGifts(db: SupabaseClient, sender: GiftSender, now = new Date(), limit = 50): Promise<DeliveryResult> {
  const today = now.toISOString().slice(0, 10);
  const { data, error } = await db
    .from("gifts")
    .select("id, plan_id, code_hash, recipient_name, recipient_email, giver_display_name, message")
    .eq("status", "scheduled")
    .lte("deliver_on", today)
    .not("recipient_email", "is", null)
    .order("deliver_on")
    .limit(limit);
  if (error) throw new Error(`read due gifts: ${error.message}`);
  const result: DeliveryResult = { sent: 0, failed: 0 };
  for (const g of (data ?? []) as Record<string, string | null>[]) {
    const code = generateGiftCode();
    const { data: claimed, error: claimError } = await db
      .from("gifts")
      .update({ code_hash: hashGiftCode(code), status: "sent", sent_at: now.toISOString() })
      .eq("id", g.id!)
      .eq("status", "scheduled")
      .select("id");
    if (claimError) throw new Error(`claim gift: ${claimError.message}`);
    if (!claimed?.length) continue;
    try {
      await sender.sendGift({
        giftId: g.id!,
        to: g.recipient_email!,
        recipientName: g.recipient_name ?? "",
        giverName: g.giver_display_name ?? "",
        message: g.message ?? "",
        planName: giftPlan(g.plan_id ?? "")?.name ?? "Readli Family",
        code,
      });
      result.sent += 1;
    } catch (err) {
      console.error("gift email failed", g.id, err);
      await db.from("gifts").update({ code_hash: g.code_hash, status: "scheduled", sent_at: null }).eq("id", g.id!);
      result.failed += 1;
    }
  }
  return result;
}
