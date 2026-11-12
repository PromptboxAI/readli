import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AskName } from "@/components/account/AskName";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { freeVoiceGate } from "@/components/voice/VoiceHome";
import { chosenName } from "@/lib/account/names";
import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { familyPage } from "@/lib/family/page-data";
import { myVoices } from "@/lib/family/service";
import { familyAccountsEnabled, familyStore } from "@/lib/family/session";
import { isParent } from "@/lib/family/storyteller";
import { pendingJoinPath } from "@/lib/invites/pending";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { markVoiceHome } from "@/lib/voice/home-progress";

export const metadata: Metadata = { title: "Welcome | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

const icon = "size-6 fill-none stroke-ink stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";

/**
 * Shown once, right after someone keeps a free Readli Voice account: who should hear them, and the three ways
 * their voice reaches those kids. Each choice opens a flow that already exists; "Look around first" goes Home.
 */
export default async function VoiceWelcomePage() {
  const user = familyAccountsEnabled() ? await currentAdult() : null;
  if (!user) redirect("/login?next=/home/welcome");
  const page = await familyPage();
  if (!page.enabled || !page.session || page.session.actor.kind !== "adult") redirect("/login?next=/home/welcome");
  const { session, state } = page;
  if (isParent(state, user.id)) redirect("/home");
  const pending = await pendingJoinPath(user.id);
  if (pending) redirect(pending);
  const store = await familyStore(session);
  const voices = store ? await myVoices(store, session.actor).catch(() => []) : [];
  await freeVoiceGate(user, state, voices.length);
  await markVoiceHome(accountDb(), user.id, "welcomed");

  const me = state?.adults.find((a) => a.id === user.id);
  const name = chosenName(me?.displayName ?? user.name, user.email, user.named);
  const gifting = Boolean(await sponsorshipContext({ newGifts: true }).catch(() => null));
  const card = "flex flex-col gap-2 rounded-[var(--radius-panel)] p-5 ring-2 ring-ink/10 transition-transform hover:-translate-y-1 focus-visible:ring-[3px] focus-visible:ring-ink motion-reduce:transform-none sm:p-6";

  return (
    <AdultPage wide>
      <header className="flex flex-wrap items-center gap-5">
        <ReadiMascot size={96} decorative />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Eyebrow>Your voice is saved</Eyebrow>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">{name ? `Who would you love to read to, ${name}?` : "Who would you love to read to?"}</h1>
          <p className="text-lg text-muted">Your free account keeps your voice. Here&apos;s how it reaches the kids you love.</p>
        </div>
      </header>
      {!name && <AskName label="First, what should families call you?" hint="Invitations use this name, like “Grandpa Joe has a bedtime story for your family.”" placeholder="Grandpa Joe, Nana, Aunt Sue…" />}
      <ul className={`grid gap-4 ${gifting ? "md:grid-cols-3" : "md:grid-cols-2"}`} data-testid="voice-welcome-choices">
        <li className="flex">
          <Link href="/voice/invite" className={`${card} flex-1 bg-sunshine/45`} data-testid="welcome-send">
            <span className="w-fit rounded-full bg-ink px-3 py-0.5 text-xs font-bold tracking-wide text-ivory uppercase">Most families start here</span>
            <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
              <path d="M3 11l18-8-8 18-2-8-8-2z" />
            </svg>
            <span className="font-display text-xl font-semibold">Send a story to my grandkids</span>
            <span>Their parents get a link and hear it in your voice, free, with no app to install.</span>
          </Link>
        </li>
        <li className="flex">
          <Link href="/home#stories" className={`${card} flex-1 bg-sky/30`} data-testid="welcome-hear">
            <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
              <path d="M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z" />
            </svg>
            <span className="font-display text-xl font-semibold">Hear more stories in my voice</span>
            <span>Six classic storybooks, read by you. Play any of them now.</span>
          </Link>
        </li>
        {gifting && (
          <li className="flex">
            <Link href="/gift/family" className={`${card} flex-1 bg-coral/20`} data-testid="welcome-gift">
              <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
                <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-6-1s4 1 6 1zm0 0c2-4 6-3 6-1s-4 1-6 1z" />
              </svg>
              <span className="font-display text-xl font-semibold">Give Readli as a gift</span>
              <span>Cover Readli Family for up to two families, so the kids can hear you at bedtime.</span>
            </Link>
          </li>
        )}
      </ul>
      <Link href="/home" className="self-start font-display text-lg font-semibold underline underline-offset-4" data-testid="welcome-skip">
        Look around first
      </Link>
    </AdultPage>
  );
}
