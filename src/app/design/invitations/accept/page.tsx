import type { Metadata } from "next";
import { pricing } from "@/lib/content/pricing";
import { formatPrice } from "@/lib/family/plan";
import { DesignFrame, SamplePlayer } from "../DesignFrame";
import { Accept } from "./Accept";

export const metadata: Metadata = { title: "Design: Family Circle acceptance | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/** A signed-in Family parent connects the contributor who invited them. */
export default async function FamilyCircleAcceptDesign() {
  const P = await pricing();
  return (
    <DesignFrame current="/design/invitations/accept">
      <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[1fr_1.3fr]">
        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="circle-h">
          <p className="font-display text-lg font-semibold text-coral-deep">The Rivera family · Family Circle</p>
          <h1 id="circle-h" className="font-display text-4xl font-semibold leading-tight">
            Add June to your Family Circle
          </h1>
          <p className="text-lg">June invited you and has already shared her voice with your family. Two choices are yours: whether she takes a storyteller slot, and which children can hear her.</p>
          <SamplePlayer label="June's voice" />
          <div className="flex flex-col gap-2 rounded-3xl bg-surface p-4 text-sm ring-2 ring-ink/10">
            <p className="font-semibold">Starting a new trial instead?</p>
            <p>
              After checkout, June is waiting in Family setup with the same two choices. Nothing is switched on for your children until you approve it.
            </p>
          </div>
        </section>
        <Accept slotPrice={formatPrice(P.extraSlotMonthlyCents)} includedSlots={P.includedNarratorSlots} />
      </main>
    </DesignFrame>
  );
}
