import type { Metadata } from "next";
import Link from "next/link";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { listDevices } from "@/lib/family/devices";
import { familyPage } from "@/lib/family/page-data";
import { activeEntitlement, liveSlots, narratorSlotCount } from "@/lib/family/permissions";
import { guardianHousehold } from "@/lib/family/service";
import { deviceRegistry, familyStore } from "@/lib/family/session";
import { creditBalance, displayCredits } from "@/lib/narration/credits";
import { BackLink } from "@/components/family/BackLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parent controls | Readli" };

type Control = { href: string; title: string; text: string; value?: string; tone: string };

/** Everything a parent manages, in one place, so the family home can stay about listening. */
export default async function ParentControls() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const session = page.session;
  const denied = <NeedsGrownUp text="Only a parent or guardian can open parent controls." />;
  if (session?.actor.kind !== "adult") return denied;
  const store = (await familyStore(session))!;
  const householdId = await guardianHousehold(store, session.actor);
  if (!householdId) return denied;
  const state = await store.read();
  const plan = store.plan;
  const kids = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null).length;
  const slots = narratorSlotCount(state, householdId, plan);
  const used = liveSlots(state, householdId, plan).length;
  const credits = creditBalance(state, plan, householdId);
  const registry = deviceRegistry(Boolean(session.account));
  const devices = registry ? (await listDevices(registry, state, session.actor, householdId)).filter((d) => d.status === "active").length : null;
  const hasPlan = Boolean(activeEntitlement(state, householdId));

  const controls: Control[] = [
    { href: "/family/kids", title: "Kids profiles", text: "Add, rename or remove children", value: `${kids} of ${plan.maxChildProfiles}`, tone: "bg-sunshine/40" },
    { href: "/family/narrators", title: "Family storytellers", text: "Narrator slots, sharing and who each child can hear", value: hasPlan ? `${used} of ${slots} slots` : undefined, tone: "bg-mint/40" },
    { href: "/family/books", title: "Family library", text: "Prepare stories in a storyteller's voice", tone: "bg-sky/30" },
    { href: "/family/credits", title: "Readli credits", text: "Your monthly allowance and history", value: `${displayCredits(credits.available, credits.unitsPerCredit).toLocaleString("en-US")} left`, tone: "bg-sunshine/40" },
    { href: "/family/billing", title: "Plan and billing", text: "Your Readli Family plan and storyteller slots", tone: "bg-lavender/40" },
    { href: "/family/devices", title: "Kids devices and PIN", text: "Readli Kids iPads and phones, and the grown-up PIN", value: devices === null ? undefined : `${devices} ${devices === 1 ? "device" : "devices"}`, tone: "bg-sky/30" },
    { href: "/family/my-voice", title: "My Voice", text: "Your own voice and which families can use it", tone: "bg-coral/20" },
    { href: "/family/account", title: "Account settings", text: "Name, photo, email and sign-in", tone: "bg-ink/5" },
  ];

  return (
    <FamilyShell>
      <PreviewNote />
      <BackLink href="/family" label="Family" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold">Parent controls</h1>
        <p className="text-lg text-muted">Manage your family, storytellers, credits and account.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="parent-controls">
        {controls.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="flex h-full items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 hover:ring-ink">
              <span aria-hidden="true" className={`size-12 shrink-0 rounded-2xl ${c.tone}`} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-lg font-semibold">{c.title}</span>
                <span className="text-sm text-muted">{c.text}</span>
              </span>
              {c.value && <span className="shrink-0 font-display font-semibold">{c.value}</span>}
              <span aria-hidden="true" className="text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">None of these open on a Readli Kids device.</p>
    </FamilyShell>
  );
}
