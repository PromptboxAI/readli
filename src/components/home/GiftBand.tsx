import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { giftSeason } from "@/lib/gifting/season";

/**
 * Homepage pointer to /gifts (SleepyTale review, 2026-11). In the holiday season it leads with
 * Christmas; the rest of the year it is a quieter evergreen line.
 */
export function GiftBand({ at = new Date() }: { at?: Date }) {
  const season = giftSeason(at);
  return (
    <section aria-labelledby="gift-band-heading" className="bg-coral/15" data-testid="home-gift-band">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-10 text-center sm:flex-row sm:px-6 sm:text-left">
        <GiftBoxArt className="w-24 shrink-0" />
        <div className="flex flex-1 flex-col gap-1">
          <h2 id="gift-band-heading" className="font-display text-2xl font-semibold sm:text-3xl">
            {season ? season.banner : "Give Readli as a gift"}
          </h2>
          <p className="text-lg">
            {season
              ? "Give your voice for Christmas. Record a minute, and the grandkids hear you read to them every night of the year."
              : "Record a minute of your voice and give Readli Family to up to two families you love."}
          </p>
        </div>
        <Link href="/gifts" className={`${buttonPrimary} w-full shrink-0 sm:w-auto`}>
          See Readli gifts
        </Link>
      </div>
    </section>
  );
}
