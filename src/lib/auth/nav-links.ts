import type { HouseholdEntitlement } from "@/lib/family/model";
import { initials } from "@/lib/content/example-family";

/** What the signed-in grown-up's households give them. Only a guardian of a household with a live plan gets Family. */
export type FamilyAccess = { plan: "none"; hadFamily: boolean } | { plan: "trial" | "paid"; endsAt: string | null };

export type NavState =
  | { kind: "visitor" }
  /** A kids profile is open on this device: no account menu, no sign-out. */
  | { kind: "kids" }
  | { kind: "adult"; name: string; email: string | null; hasVoice: boolean; family: FamilyAccess; trialOffered: boolean; avatarUrl?: string | null };

export interface NavLink {
  href: string;
  label: string;
  tone?: "offer" | "danger";
}

type Plan = Pick<HouseholdEntitlement, "source" | "status" | "startsAt" | "endsAt">;

/** Trial, paid (subscription, gift, donated or tester) or none, from the plans of the households someone guards. */
export function familyAccess(plans: Plan[], at = new Date().toISOString()): FamilyAccess {
  const live = plans.filter((p) => p.status === "active" && p.startsAt <= at && (p.endsAt === null || p.endsAt > at));
  const paid = live.find((p) => p.source !== "trial");
  if (paid) return { plan: "paid", endsAt: paid.endsAt };
  const trial = live.find((p) => p.source === "trial");
  if (trial) return { plan: "trial", endsAt: trial.endsAt };
  return { plan: "none", hadFamily: plans.length > 0 };
}

/** The main button: the most useful next place for this account, or none when the account menu already holds it. */
export function primaryAction(nav: NavState): NavLink | null {
  if (nav.kind === "kids") return { href: "/kids", label: "Readli Kids" };
  if (nav.kind === "visitor") return { href: "/try", label: "Try It Free" };
  // A Family account reaches My Family from the account menu, so the header doesn't repeat it as a button.
  return nav.family.plan === "none" ? { href: "/voice", label: "My Voice" } : null;
}

/** The account menu, showing only places this account can open. Sign out is added by the menu itself. */
export function accountLinks(nav: Extract<NavState, { kind: "adult" }>): NavLink[] {
  const links: NavLink[] = [];
  if (nav.family.plan !== "none") links.push({ href: "/family", label: "My Family" });
  links.push({ href: nav.family.plan === "none" ? "/voice" : "/family/my-voice", label: "My Voice" }, { href: "/family/account", label: "Account settings" }, { href: "/help", label: "Help" });
  if (nav.family.plan === "trial") links.push({ href: "/family/billing", label: "Choose a plan", tone: "offer" });
  if (nav.trialOffered) links.push({ href: "/signup/family", label: "Start a free Family trial", tone: "offer" });
  return links;
}

/** A short line under the name in the account menu, such as when a trial ends. */
export function accountBadge(nav: Extract<NavState, { kind: "adult" }>): string | null {
  if (nav.family.plan !== "trial") return null;
  if (!nav.family.endsAt) return "Family trial";
  const day = new Date(nav.family.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `Family trial · ends ${day}`;
}

export function accountInitials(name: string): string {
  return initials(name) || "?";
}
