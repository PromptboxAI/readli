import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadyNotice } from "@/lib/family/service";
import { storytellerReadyEmail, type Mailer } from "@/lib/invitations/email";

export type ReadyEmailOutcome = "sent" | "already_sent" | "no_invitation" | "off" | "failed";

/**
 * Emails the parent who invited this storyteller that their voice is ready and shared. Sent at most
 * once per invitation: the invitation is claimed in the database before sending, and Resend gets
 * an idempotency key too. The family's in-app notice is saved separately, so nothing is lost if
 * email is off or fails. Never throws: sharing has already happened.
 */
export async function emailStorytellerReady(
  db: SupabaseClient,
  mailer: Mailer | null,
  origin: string,
  input: { householdId: string; storytellerId: string; notice: ReadyNotice },
  now = new Date(),
): Promise<ReadyEmailOutcome> {
  if (!mailer) return "off";
  let claimed: string[] = [];
  try {
    const { data, error } = await db
      .from("household_invitations")
      .update({ ready_notified_at: now.toISOString() })
      .eq("household_id", input.householdId)
      .eq("accepted_by", input.storytellerId)
      .is("ready_notified_at", null)
      .select("id, inviter_id");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; inviter_id: string }[];
    if (rows.length === 0) {
      const { data: earlier } = await db
        .from("household_invitations")
        .select("id")
        .eq("household_id", input.householdId)
        .eq("accepted_by", input.storytellerId)
        .limit(1);
      return earlier?.length ? "already_sent" : "no_invitation";
    }
    claimed = rows.map((r) => r.id);
    const { id, inviter_id: inviterId } = rows[0]!;
    const [{ data: user }, { data: profile }] = await Promise.all([
      db.auth.admin.getUserById(inviterId),
      db.from("adult_profiles").select("display_name").eq("user_id", inviterId).limit(1),
    ]);
    const to = user?.user?.email;
    if (!to) throw new Error("inviter has no email");
    const parentName = ((profile?.[0] as { display_name?: string } | undefined)?.display_name ?? "").split(" ")[0] || "there";
    const email = storytellerReadyEmail({
      parentName,
      title: input.notice.title,
      body: input.notice.body,
      cta: input.notice.cta,
      ctaUrl: `${origin.replace(/\/$/, "")}${input.notice.href}`,
    });
    await mailer.send({ ...email, to, idempotencyKey: `storyteller-ready-${id}` });
    return "sent";
  } catch (err) {
    console.error("storyteller ready email failed", input.householdId, err);
    // Let a later share try again rather than marking an email as sent that wasn't.
    if (claimed.length) await db.from("household_invitations").update({ ready_notified_at: null }).in("id", claimed);
    return "failed";
  }
}
