import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth/supabase";
import { photoUrl } from "@/lib/account/photos";
import { accountDb } from "@/lib/family/account-store";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import type { FamilyState } from "@/lib/family/model";
import { currentSession, familyAccountsEnabled, familyStore } from "@/lib/family/session";
import { familyAccess, type FamilyAccess, type NavState } from "./nav-links";
import { rewardsVisible } from "@/lib/rewards/rewards";

export * from "./nav-links";

function adult(name: string, email: string | null, hasVoice: boolean, family: FamilyAccess, avatarUrl: string | null = null): NavState {
  // A Family trial is offered only to someone who has never had Readli Family, and only where the trial is shown.
  const trialOffered = family.plan === "none" && !family.hadFamily && rewardsVisible();
  return { kind: "adult", name, email, hasVoice, family, trialOffered, avatarUrl };
}

/** Real accounts: a few small reads, so the header never shows the wrong buttons first. */
async function accountNav(user: { id: string; name: string; email: string | null }): Promise<NavState> {
  const db = accountDb();
  if (!db) return adult(user.name, user.email, false, { plan: "none", hadFamily: true });
  const [homes, voice, me] = await Promise.all([
    db.from("household_members").select("household_id").eq("user_id", user.id).eq("role", "guardian").is("removed_at", null),
    db.from("voice_profiles").select("id").eq("owner_id", user.id).neq("status", "deleted").limit(1),
    db.from("adult_profiles").select("avatar_path, photo_consent_at").eq("user_id", user.id).maybeSingle(),
  ]);
  const consentAt = (me.data?.photo_consent_at as string | null | undefined) ?? null;
  const avatarUrl = me.data?.avatar_path && consentAt ? photoUrl(user.id, consentAt) : null;
  const ids = (homes.data ?? []).map((h) => h.household_id as string);
  const plans = ids.length
    ? ((await db.from("household_entitlements").select("source, status, starts_at, ends_at").in("household_id", ids)).data ?? []).map((p) => ({
        source: p.source,
        status: p.status,
        startsAt: p.starts_at as string,
        endsAt: (p.ends_at as string | null) ?? null,
      }))
    : [];
  // If a read failed, don't offer a trial we can't vouch for.
  const failed = Boolean(homes.error || voice.error);
  const family = familyAccess(plans);
  return adult(user.name, user.email, (voice.data ?? []).length > 0, failed && family.plan === "none" ? { plan: "none", hadFamily: true } : family, avatarUrl);
}

function previewNav(state: FamilyState, adultId: string): NavState {
  const me = state.adults.find((a) => a.id === adultId);
  const homes = new Set(state.members.filter((m) => m.adultId === adultId && m.role === "guardian" && m.removedAt === null).map((m) => m.householdId));
  const plans = state.entitlements.filter((e) => homes.has(e.householdId));
  const hasVoice = state.voices.some((v) => v.ownerId === adultId && v.deletedAt === null);
  return adult(me?.displayName ?? "Grown-up", null, hasVoice, familyAccess(plans));
}

/** Who the header is for: a visitor, a kids device, or a grown-up and what their account includes. */
export async function navState(): Promise<NavState> {
  const jar = await cookies();
  // A kids device holds only its device key (the grown-up was signed out on it), so check it first.
  if (jar.get(KIDS_COOKIE)?.value) return { kind: "kids" };
  if (familyAccountsEnabled()) {
    // No Supabase cookie means nobody is signed in, so most visitors cost no request.
    if (jar.getAll().some((c) => c.name.startsWith("sb-"))) {
      const user = await currentUser();
      if (user) return accountNav(user);
    }
  }
  const session = await currentSession();
  if (!session || session.account) return { kind: "visitor" };
  if (session.actor.kind === "child") return { kind: "kids" };
  const store = await familyStore(session);
  return store ? previewNav(await store.read(), session.actor.adultId) : { kind: "visitor" };
}
