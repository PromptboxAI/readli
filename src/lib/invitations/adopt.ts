import type { Actor } from "@/lib/family/model";
import { activeEntitlement, activeShare, activeSlot, countedSlots, narratorSlotCount } from "@/lib/family/permissions";
import { activateNarrator, setChildApprovals, type FamilyStore } from "@/lib/family/service";
import { carriedInvitationToken, invitationContext, requestOrigin } from "./context";
import { acceptInvitation, landingFor } from "./server";

/**
 * What adopting the carried invitation did. "reload": the storyteller was just connected in the database, so the
 * page's family state is out of date and the page should load again. "none": nothing to do, or nothing changed.
 */
export type Adoption = "reload" | "none";

/**
 * A family that started from a storyteller's invitation (the invitation's cookie came with them through signup
 * and checkout) takes that storyteller in without asking again: they pressed "Start Readli Family" or "Connect"
 * on the invitation already. Connects them to the family, then, once the plan is on, gives them a storyteller
 * slot if one is free, so they're the family's first storyteller.
 *
 * With `approveKids`, used only by setup's walkthrough, each child in the family who has never had a choice made
 * about this storyteller can hear them too: a child added in setup hears the person who invited the family, and
 * setup says so. A choice the parent made (including turning them off) is never changed.
 */
export async function adoptCarriedInvitation(store: FamilyStore, actor: Actor, householdId: string, opts: { approveKids?: boolean } = {}): Promise<Adoption> {
  if (actor.kind !== "adult") return "none";
  const token = await carriedInvitationToken();
  const ctx = token ? invitationContext() : null;
  if (!token || !ctx) return "none";
  const landing = await landingFor(ctx.db, ctx.secret, token).catch(() => null);
  if (!landing) return "none";

  if (landing.status === "pending" || landing.status === "opened") {
    const result = await acceptInvitation(ctx.db, token, actor.adultId, householdId, { mailer: ctx.mailer, origin: await requestOrigin() }).catch((err: unknown) => {
      console.error("adopt invitation: accept failed", err);
      return "invalid" as const;
    });
    return result === "accepted" ? "reload" : "none";
  }
  if (landing.status !== "accepted" || landing.householdId !== householdId) return "none";

  const state = await store.read();
  if (!activeEntitlement(state, householdId)) return "none";
  const voice = state.voices.find((v) => v.ownerId === landing.contributorId && v.deletedAt === null && activeShare(state, v.id, householdId));
  if (!voice) return "none";

  if (!activeSlot(state, voice.id, householdId, store.plan)) {
    // A slot the parent already gave someone else is theirs to swap: never take one away.
    if (countedSlots(state, householdId, store.plan).length >= narratorSlotCount(state, householdId, store.plan)) return "none";
    // Only once: a storyteller the parent later took out of their slot stays out.
    if (state.slots.some((a) => a.voiceId === voice.id && a.householdId === householdId)) return "none";
    try {
      await activateNarrator(store, actor, householdId, voice.id);
    } catch (err) {
      console.error("adopt invitation: activate failed", err);
      return "none";
    }
  }

  if (opts.approveKids) {
    const now = await store.read();
    const kids = now.children.filter((c) => c.householdId === householdId && c.deletedAt === null);
    const unchosen = kids.filter((k) => !now.approvals.some((a) => a.voiceId === voice.id && a.childId === k.id));
    for (const k of unchosen) {
      await setChildApprovals(store, actor, k.id, [{ voiceId: voice.id, approved: true }]).catch((err: unknown) => console.error("adopt invitation: approve failed", err));
    }
  }
  return "none";
}

/** The storyteller whose invitation this browser carried in, by name, while it can still be used or was used by this family. */
export async function carriedStoryteller(householdId: string | null): Promise<{ name: string; contributorId: string } | null> {
  const token = await carriedInvitationToken();
  const ctx = token ? invitationContext() : null;
  if (!token || !ctx) return null;
  const landing = await landingFor(ctx.db, ctx.secret, token).catch(() => null);
  if (!landing) return null;
  const usable = landing.status === "pending" || landing.status === "opened" || (landing.status === "accepted" && householdId !== null && landing.householdId === householdId);
  return usable ? { name: landing.contributorName, contributorId: landing.contributorId } : null;
}
