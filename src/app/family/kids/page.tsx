import type { Metadata } from "next";
import Link from "next/link";
import { ChildProfiles } from "@/components/family/ChildProfiles";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { familyPage } from "@/lib/family/page-data";
import { activeEntitlement, countedSlots, narratorSlotCount } from "@/lib/family/permissions";
import { childProfiles, guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kids profiles | Readli" };

/** The Family tab: the kids, then who reads to them. */
export default async function ChildProfilesPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can manage kids profiles." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can manage kids profiles." />;
  const state = await store.read();
  const slots = activeEntitlement(state, householdId) ? `${countedSlots(state, householdId, store.plan).length} of ${narratorSlotCount(state, householdId, store.plan)} slots` : null;
  const readers = [
    { href: "/family/narrators", title: "Family storytellers", text: "Narrator slots, invitations and who each child can hear", value: slots },
    { href: "/family/my-voice", title: "My Voice", text: "Your recordings and which families can use them", value: null },
  ];
  return (
    <FamilyShell>
      <PreviewNote />
      <ChildProfiles initial={await childProfiles(store, page.session.actor, householdId)} />
      <section className="flex flex-col gap-3" aria-labelledby="readers-h" data-testid="family-readers">
        <h2 id="readers-h" className="font-display text-2xl font-semibold">
          Who reads to them
        </h2>
        <ul className="divide-y-2 divide-ink/5 overflow-hidden rounded-3xl bg-surface ring-2 ring-ink/10">
          {readers.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-ivory">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-display text-lg font-semibold">{r.title}</span>
                  <span className="text-sm text-muted">{r.text}</span>
                </span>
                {r.value && <span className="shrink-0 text-right font-display font-semibold">{r.value}</span>}
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </FamilyShell>
  );
}
