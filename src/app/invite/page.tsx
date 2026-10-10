import type { Metadata } from "next";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { InviteActions } from "@/components/invites/InviteActions";
import { TwoYeses } from "@/components/invites/TwoYeses";

export const metadata: Metadata = { title: "Invite | Readli", robots: { index: false } };

const DOES = [
  "Adds them to your family circle",
  "Lets them record their own voice",
  "Lets you ask to use their voice",
];
const DOES_NOT = [
  "Share anyone's voice on its own",
  "Start a paid plan for them",
  "Let your kids hear anyone you haven't approved",
];

export default function InvitePage() {
  return (
    <AdultPage>
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <ReadiMascot size={110} decorative />
        <div className="flex flex-col gap-2">
          <Eyebrow>Grow your story circle</Eyebrow>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Invite someone special</h1>
          <p className="text-lg">Bring a storyteller into your family, or give another family Readli of their own.</p>
        </div>
      </header>
      <InviteActions />
      <section aria-labelledby="invite-means" className="grid gap-4 sm:grid-cols-2">
        <h2 id="invite-means" className="sr-only">
          What an invitation does
        </h2>
        <div className="rounded-[var(--radius-panel)] bg-mint/40 p-6">
          <h3 className="font-display text-xl font-semibold">An invitation does</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {DOES.map((d) => (
              <li key={d} className="flex gap-2">
                <span aria-hidden="true">✓</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10">
          <h3 className="font-display text-xl font-semibold">An invitation doesn&apos;t</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {DOES_NOT.map((d) => (
              <li key={d} className="flex gap-2">
                <span aria-hidden="true">✕</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <TwoYeses />
    </AdultPage>
  );
}
