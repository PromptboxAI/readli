import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { FamilyOff, FamilyShell, PreviewNote } from "@/components/family/FamilyShell";
import { ResetButton } from "@/components/family/ResetButton";
import { SessionButton } from "@/components/family/SessionButton";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import { demoFamilyState } from "@/lib/family/demo-family";
import { familyPage, guardianChildren } from "@/lib/family/page-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Readli Family | Readli" };

export default async function FamilyHome() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const { session, state } = page;
  const adult = session?.actor.kind === "adult" && state ? state.adults.find((a) => a.id === (session.actor as { adultId: string }).adultId) : null;

  if (!adult || !state) {
    const people = demoFamilyState().adults;
    return (
      <FamilyShell>
        <h1 className="font-display text-4xl font-semibold">Readli Family</h1>
        <PreviewNote />
        <p className="text-lg">
          {session?.actor.kind === "child" ? "Grown-ups, sign in to leave the kids profile. " : ""}
          Choose who you are to explore the preview family.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-3xl bg-surface p-3 ring-2 ring-ink/10">
              <StorytellerAvatar name={p.displayName} avatarUrl={p.avatarUrl} tint={p.tint} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold">{p.displayName}</p>
                <p className="text-sm text-muted">{p.relationship}</p>
              </div>
              <SessionButton as={`adult:${p.id}`} next="/family" className={buttonSecondary}>
                <span className="sr-only">Sign in as {p.displayName}</span>
                <span aria-hidden="true">I&apos;m {p.displayName.split(" ").pop()}</span>
              </SessionButton>
            </li>
          ))}
        </ul>
      </FamilyShell>
    );
  }

  const kids = guardianChildren(state, adult.id);
  const isGuardian = state.members.some((m) => m.adultId === adult.id && m.role === "guardian" && m.removedAt === null);
  return (
    <FamilyShell>
      <div className="flex items-center gap-4">
        <StorytellerAvatar name={adult.displayName} avatarUrl={adult.avatarUrl} tint={adult.tint} size="lg" />
        <div>
          <p className="text-muted">Signed in as</p>
          <h1 className="font-display text-4xl font-semibold">{adult.displayName}</h1>
          <p className="text-muted">{adult.relationship}</p>
        </div>
      </div>
      <PreviewNote />

      <section className="flex flex-col gap-3" aria-labelledby="my-voice-h">
        <h2 id="my-voice-h" className="font-display text-2xl font-semibold">Your voice</h2>
        <p>Your voice is private until you share it. You decide which families can use it.</p>
        <Link href="/family/my-voice" className={`${buttonSecondary} self-start`}>
          Who can use my voice
        </Link>
      </section>

      {isGuardian && (
        <section className="flex flex-col gap-3" aria-labelledby="slots-h">
          <h2 id="slots-h" className="font-display text-2xl font-semibold">Your family&apos;s narrators</h2>
          <p>Choose which shared voices fill your narrator slots.</p>
          <Link href="/family/narrators" className={`${buttonSecondary} self-start`}>
            Narrator slots
          </Link>
        </section>
      )}

      {isGuardian && (
        <section className="flex flex-col gap-3" aria-labelledby="kids-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="kids-h" className="font-display text-2xl font-semibold">Kids profiles</h2>
            <Link href="/family/kids" className="font-semibold underline underline-offset-4">
              Add or remove kids
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {kids.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                <div className="flex items-center gap-3">
                  <StorytellerAvatar name={c.nickname} avatarUrl={null} tint={c.tint} />
                  <p className="font-display text-2xl font-semibold">{c.nickname}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/family/kids/${c.id}/storytellers`} className={buttonPrimary}>
                    Manage storytellers
                  </Link>
                  <SessionButton as={`child:${c.id}`} next="/kids" className={buttonSecondary}>
                    Open {c.nickname}&apos;s Readli Kids
                  </SessionButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <SessionButton as={null} next="/family" className={buttonSecondary}>
          Sign out
        </SessionButton>
        <ResetButton />
      </div>
    </FamilyShell>
  );
}
