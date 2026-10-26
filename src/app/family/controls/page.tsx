import type { Metadata } from "next";
import Link from "next/link";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { listDevices } from "@/lib/family/devices";
import { familyPage } from "@/lib/family/page-data";
import { activeEntitlement, childProfileLimit, countedSlots, narratorSlotCount } from "@/lib/family/permissions";
import { guardianHousehold } from "@/lib/family/service";
import { deviceRegistry, familyStore } from "@/lib/family/session";
import { creditBalance, displayCredits } from "@/lib/narration/credits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parent Controls | Readli" };

type Control = { href: string; title: string; text: string; value?: string };

/** Parent Controls: every setting a parent manages, grouped, so the family home can stay about listening. */
export default async function ParentControls() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const session = page.session;
  const denied = <NeedsGrownUp text="Only a parent or guardian can open Parent Controls." />;
  if (session?.actor.kind !== "adult") return denied;
  const store = (await familyStore(session))!;
  const householdId = await guardianHousehold(store, session.actor);
  if (!householdId) return denied;
  const state = await store.read();
  const plan = store.plan;
  const kids = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null).length;
  const slots = narratorSlotCount(state, householdId, plan);
  const used = countedSlots(state, householdId, plan).length;
  const credits = creditBalance(state, plan, householdId);
  const registry = deviceRegistry(Boolean(session.account));
  const devices = registry ? (await listDevices(registry, state, session.actor, householdId)).filter((d) => d.status === "active").length : null;
  const hasPin = registry ? Boolean(await registry.pinHash(householdId)) : false;
  const hasPlan = Boolean(activeEntitlement(state, householdId));

  const groups: { title: string; controls: Control[] }[] = [
    {
      title: "Family",
      controls: [
        { href: "/family/kids", title: "Kids profiles", text: "Add, rename or remove children, and open Readli Kids", value: `${kids} of ${childProfileLimit(state, householdId, plan) || plan.maxChildProfiles}` },
        { href: "/family/narrators", title: "Family storytellers", text: "Narrator slots, sharing and who each child can hear", value: hasPlan ? `${used} of ${slots} slots` : undefined },
        { href: "/family/my-voice", title: "My Voice", text: "Your recordings, which families can use them, and deleting them" },
      ],
    },
    {
      title: "Credits and billing",
      controls: [
        { href: "/family/credits", title: "Readli credits", text: "Your monthly allowance and history", value: `${displayCredits(credits.available, credits.unitsPerCredit).toLocaleString("en-US")} left` },
        { href: "/family/billing", title: "Plan and billing", text: "Your Readli Family plan and storyteller slots" },
      ],
    },
    {
      title: "Kids devices",
      controls: [
        {
          href: "/family/devices",
          title: "Kids devices and PIN",
          text: "Register a child\u2019s own iPad or phone, and set the family PIN that leaves Kids Mode",
          value: devices === null ? undefined : `${hasPin ? "PIN set · " : ""}${devices} ${devices === 1 ? "device" : "devices"}`,
        },
      ],
    },
    {
      title: "Account",
      controls: [
        { href: "/family/account", title: "Account settings", text: "Name, photo, email, sign-in, your data and deleting your account" },
        { href: "/help", title: "Help", text: "Guides and how to reach us" },
      ],
    },
  ];
  const column = (list: typeof groups) => (
    <div className="flex flex-col gap-6">
      {list.map((g) => (
        <section key={g.title} className="flex flex-col gap-2" aria-labelledby={`group-${g.title}`}>
          <h2 id={`group-${g.title}`} className="ml-1 text-sm font-bold tracking-wider text-muted uppercase">
            {g.title}
          </h2>
          <ul className="divide-y-2 divide-ink/5 overflow-hidden rounded-3xl bg-surface ring-2 ring-ink/10">
            {g.controls.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-ivory">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-display text-lg font-semibold">{c.title}</span>
                    <span className="text-sm text-muted">{c.text}</span>
                  </span>
                  {c.value && <span className="shrink-0 text-right font-display font-semibold">{c.value}</span>}
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <FamilyShell>
      <PreviewNote />
      <h1 className="font-display text-4xl font-semibold">Parent Controls</h1>
      <div className="grid items-start gap-6 lg:grid-cols-2" data-testid="parent-controls">
        {column([groups[0]!, groups[2]!])}
        {column([groups[1]!, groups[3]!])}
      </div>
      <p className="max-w-3xl text-sm text-muted">
        Billing changes, deleting a voice or your account, and changing who a voice is shared with always need you to sign in again, never just the family
        PIN. None of these open on a Readli Kids device.
      </p>
    </FamilyShell>
  );
}
