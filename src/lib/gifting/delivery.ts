import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { giftEmail, type Mailer } from "@/lib/invitations/email";
import { emailHash } from "@/lib/invitations/server";
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
  /** True when this address asked Readli to stop emailing it. Those gifts stay scheduled and aren't sent. */
  suppressed?(email: string): Promise<boolean>;
}

export interface DeliveryResult {
  sent: number;
  failed: number;
  held: number;
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
  const result: DeliveryResult = { sent: 0, failed: 0, held: 0 };
  for (const g of (data ?? []) as Record<string, string | null>[]) {
    if (await sender.suppressed?.(g.recipient_email!)) {
      result.held += 1;
      continue;
    }
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

/** One-click unsubscribe from a gift email: Readli stops emailing that address. Returns false for a bad token. */
export async function unsubscribeGiftRecipient(db: SupabaseClient, secret: string, token: string): Promise<boolean> {
  const id = giftIdFromToken(secret, token);
  if (!id) return false;
  const { data, error } = await db.from("gifts").select("recipient_email").eq("id", id).maybeSingle();
  if (error) throw new Error(`read gift: ${error.message}`);
  if (!data) return false;
  const to = (data as { recipient_email: string | null }).recipient_email;
  if (!to) return true;
  const { error: insertError } = await db.from("email_suppressions").insert({ email_hash: emailHash(secret, to), contributor_id: null, reason: "unsubscribed" });
  if (insertError && !/duplicate|unique/i.test(insertError.message)) throw new Error(`suppress: ${insertError.message}`);
  return true;
}

/** A stable, unguessable link for one gift's unsubscribe: the gift id signed with the server secret. */
export function giftToken(secret: string, giftId: string): string {
  return `${giftId}.${createHmac("sha256", `readli-gift:${secret}`).update(giftId).digest("base64url").slice(0, 22)}`;
}

export function giftIdFromToken(secret: string, token: string): string | null {
  const id = token.split(".")[0] ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const want = Buffer.from(giftToken(secret, id));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

/** Sends gift emails through Readli's mailer (Resend), linking to the gift and to one-click unsubscribe. */
export function mailerGiftSender(db: SupabaseClient, mailer: Mailer, origin: string, secret: string): GiftSender {
  const base = origin.replace(/\/$/, "");
  return {
    async suppressed(to) {
      const { data, error } = await db.from("email_suppressions").select("id").eq("email_hash", emailHash(secret, to)).is("contributor_id", null).limit(1);
      if (error) throw new Error(`read suppressions: ${error.message}`);
      return (data ?? []).length > 0;
    },
    async sendGift(e) {
      const email = giftEmail({
        giverName: e.giverName,
        recipientName: e.recipientName,
        message: e.message,
        planName: e.planName,
        code: e.code,
        openUrl: `${base}/gift/open?code=${encodeURIComponent(e.code)}`,
        oneClickUnsubscribeUrl: `${base}/api/gifts/unsubscribe/${giftToken(secret, e.giftId)}`,
      });
      await mailer.send({ to: e.to, ...email });
    },
  };
}
