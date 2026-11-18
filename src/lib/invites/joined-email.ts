import type { SupabaseClient } from "@supabase/supabase-js";
import { queueEmails, type QueuedEmail } from "@/lib/email/outbox";
import { preferencesUrl } from "@/lib/email/preferences";
import { readliEmail } from "@/lib/email/templates";
import { hashInviteToken } from "./server";

type Row = Record<string, unknown>;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

export interface JoinedEmailContext {
  db: SupabaseClient;
  secret: string;
  base: string;
}

/**
 * I4: tells whoever sent a co-parent invitation that it was accepted. The wording doesn't assume a
 * partner or co-parent (Kevin, 2026-11-05): it says who joined and that they now have parent access.
 * Returns the outbox ids queued, so the caller can send them straight away.
 */
export async function queueInviterJoinedEmail(ctx: JoinedEmailContext, token: string, joinerId: string): Promise<string[]> {
  const [inv] = await q(
    ctx.db.from("household_invitations").select("id, household_id, inviter_id, invitee_name, invitee_role, accepted_by").eq("token_hash", hashInviteToken(token)).limit(1),
    "read accepted invitation",
  );
  if (!inv || inv.invitee_role !== "guardian" || inv.accepted_by !== joinerId) return [];
  const inviter = inv.inviter_id as string;
  if (!inviter || inviter === joinerId) return [];
  const [people, homes] = await Promise.all([
    q(ctx.db.from("adult_profiles").select("user_id, display_name").in("user_id", [inviter, joinerId]), "read names"),
    q(ctx.db.from("households").select("id, name").eq("id", inv.household_id as string).limit(1), "read family"),
  ]);
  const nameOf = (id: string) => String(people.find((p) => p.user_id === id)?.display_name ?? "").trim();
  const who = nameOf(joinerId) || String(inv.invitee_name ?? "").trim() || "The person you invited";
  const family = String(homes[0]?.name ?? "").trim();
  const email: QueuedEmail = {
    emailId: "I4",
    dedupeKey: `I4:${inv.id as string}`,
    to: { userId: inviter },
    householdId: inv.household_id as string,
    message: readliEmail({
      subject: `${who} joined your family on Readli`,
      name: nameOf(inviter).split(/\s+/)[0] ?? "",
      title: `${who} joined ${family ? family : "your family"} on Readli`,
      paragraphs: [
        `${who} accepted your invitation and now has parent access to your family. They can see your children's profiles, choose books and storytellers, and change settings with you. Billing stays with the plan's owner.`,
        "If you weren't expecting this, you can remove them in Settings, under Parents.",
      ],
      cta: { label: "See your family's grown-ups", url: `${ctx.base}/family/settings/parents` },
      reason: "You're getting this because you invited someone to help run your family on Readli.",
      preferencesUrl: preferencesUrl(ctx.base, ctx.secret, inviter),
    }),
  };
  return queueEmails(ctx.db, ctx.secret, [email]);
}
