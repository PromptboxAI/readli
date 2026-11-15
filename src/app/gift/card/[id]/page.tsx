import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { ResendFromCardButton } from "@/components/sponsorship/ResendFromCardButton";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { shortDate } from "@/lib/sponsorship/rules";
import { cardLanding } from "@/lib/sponsorship/view";

export const metadata: Metadata = { title: "Your Readli gift | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where the printed gift card's QR code goes. It welcomes the family and tells them how to open the gift,
 * but never opens it itself: that still takes the link in the invitation email.
 */
export default async function GiftCardLandingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const seat = Number(typeof q.seat === "string" ? q.seat : "1");
  const ctx = await sponsorshipContext();
  const gift = ctx ? await cardLanding(ctx.db, id, seat).catch(() => null) : null;

  if (!gift) {
    return (
      <AdultPage gift>
        <section className="flex flex-col items-center gap-4 text-center">
          <GiftBoxArt className="w-32" />
          <h1 className="font-display text-4xl font-semibold">We couldn&apos;t find this gift</h1>
          <p className="max-w-lg text-lg">Check the email Readli sent you for your gift link, or ask the person who gave it to you.</p>
          <Link href="/how-it-works" className={buttonSecondary}>
            See how Readli works
          </Link>
        </section>
      </AdultPage>
    );
  }

  const from = gift.giverName || "Someone who loves you";
  return (
    <AdultPage gift>
      <section className="flex flex-col items-center gap-5 text-center">
        <GiftBoxArt open={gift.status !== "arrives"} className="w-36 motion-safe:animate-bob" />
        <Eyebrow>A gift for {gift.recipientName || "your family"}</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          {from} gave your family {gift.plan === "annual" ? "a year of Readli" : "Readli"}!
        </h1>
        <p className="max-w-xl text-lg">
          Classic storybooks, read aloud
          {gift.sharesVoice ? ` in ${from}'s own voice` : " in the voices your kids love"}, at bedtime or any time. No app to install and no tech skills needed.
        </p>

        {gift.status === "arrives" && (
          <div className="flex max-w-xl flex-col gap-2 rounded-3xl bg-sky/25 px-6 py-5">
            <p className="font-display text-2xl font-semibold">Your gift arrives on {shortDate(new Date(gift.deliverAt))}</p>
            <p className="text-lg">That morning, a parent gets an email from Readli with a link to open it. Tap it, add your kids, and pick tonight&apos;s story.</p>
          </div>
        )}

        {gift.status === "invited" && (
          <div className="flex max-w-xl flex-col items-center gap-4 rounded-3xl bg-sunshine/40 px-6 py-5">
            <p className="font-display text-2xl font-semibold">Your invitation is in your email</p>
            <p className="text-lg">
              Look for an email from Readli called &ldquo;{from} gave your family Readli&rdquo;. Tap <strong>Open your gift</strong>, add your kids, and pick tonight&apos;s story.
            </p>
            <p className="text-base text-ink/80">Can&apos;t find it? Check your spam folder, or we can send it again to the address {from} gave us.</p>
            <ResendFromCardButton id={id} seat={seat} />
          </div>
        )}

        {gift.status === "joined" && (
          <div className="flex max-w-xl flex-col items-center gap-4 rounded-3xl bg-mint/40 px-6 py-5">
            <p className="font-display text-2xl font-semibold">Your family already opened this gift</p>
            <p className="text-lg">Sign in to Readli to pick tonight&apos;s story.</p>
            <Link href="/login?next=/family" className={buttonPrimary}>
              Sign in
            </Link>
          </div>
        )}

        {gift.status === "ended" && <p className="max-w-xl rounded-3xl bg-surface px-6 py-5 text-lg ring-2 ring-ink/10">This gift has ended. You can still keep listening with your own Readli Family plan.</p>}

        <Link href="/how-it-works" className="font-semibold underline underline-offset-4">
          See how Readli works
        </Link>
      </section>
    </AdultPage>
  );
}
