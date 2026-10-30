import type { Metadata } from "next";
import Link from "next/link";
import { PlanList } from "@/components/accounts/PlanList";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { CREDIT_EXAMPLE_SLUGS, bookCredits, monthsOfCredits, storiesPerMonth } from "@/lib/content/credits-explained";
import { annualSavingsPercent, monthlyTotalCents, pricing, type Pricing } from "@/lib/content/pricing";
import { SPONSORED } from "@/lib/sponsorship/rules";
import { bookPath } from "@/lib/library/paths";
import { publicLibrary } from "@/lib/library/public";
import { formatPrice as dollars } from "@/lib/family/plan";
import { SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

/** Built from the saved prices, so search results never show a price the page no longer does. */
export async function generateMetadata(): Promise<Metadata> {
  const P = await pricing();
  return publicPageMetadata({
    title: "Pricing | Readli",
    description: `Readli Family is ${dollars(P.familyMonthlyCents)} a month with ${P.includedNarratorSlots} family storytellers and ${P.monthlyCredits} narration credits. Readli Voice is always free.`,
    path: "/pricing",
  });
}

/** The plans as schema.org offers, matching the prices shown on the page. */
function pricingLd(P: Pricing) {
  const usd = (cents: number) => (cents / 100).toFixed(2);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Readli",
    url: SITE_URL,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Web",
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: [
      { "@type": "Offer", name: "Readli Family, monthly", price: usd(P.familyMonthlyCents), priceCurrency: "USD", url: absoluteUrl("/pricing") },
      { "@type": "Offer", name: "Readli Family, annual", price: usd(P.familyAnnualCents), priceCurrency: "USD", url: absoluteUrl("/pricing") },
      { "@type": "Offer", name: "Readli Voice", price: "0", priceCurrency: "USD", url: absoluteUrl("/pricing") },
    ],
  };
}

// Shows the prices an admin saved, so it renders per request.
export const dynamic = "force-dynamic";

const familyHighlights = (P: Pricing, stories: number) => [
  `${P.includedNarratorSlots} family storytellers included`,
  `${P.maxChildProfiles} child profiles`,
  `${P.simultaneousListeners} children listening at once`,
  `${P.monthlyCredits} narration credits every month, about ${stories} new bedtime stories`,
  "Replay your prepared stories as often as you like",
  "Invite loved ones to share their voices for free",
];

const VOICE_HIGHLIGHTS = [
  "Record your voice once",
  "Share it with every family you choose",
  "Change or stop sharing at any time",
  "Never pay to record or share your voice",
];

const NO_CREDITS = [
  "Replaying stories you've already prepared",
  "Switching between prepared family voices",
  "Browsing the library",
  "Inviting relatives",
  "Adding child profiles",
];

const NARRATOR_EXAMPLES = [
  { who: "Mom + Dad", count: 2 },
  { who: "Mom + Dad + Grandma", count: 3 },
  { who: "Mom + Dad + Grandma + Grandpa", count: 4 },
];

/** Readli's gift, Sponsored Family: one plan shared by up to two families, paid by the giver. */
const GIFTS = [
  { id: "annual", name: "A whole year", price: dollars(SPONSORED.annualCents), summary: "Paid once. It never renews on its own." },
  { id: "monthly", name: "Month to month", price: `${dollars(SPONSORED.monthlyCents)} a month`, summary: "You cover it each month until you stop." },
];

export default async function PricingPage() {
  const P = await pricing();
  const library = publicLibrary();
  const stories = storiesPerMonth(P.monthlyCredits, library, P.charactersPerCredit);
  const examples = CREDIT_EXAMPLE_SLUGS.map((slug) => library.find((b) => b.slug === slug && b.characters !== null)).filter((b) => b !== undefined);
  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(pricingLd(P))} />
        <section aria-labelledby="pricing-heading" className="bg-sunshine/35 px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
            <h1 id="pricing-heading" className="font-display text-4xl font-semibold sm:text-5xl">
              Pricing
            </h1>
            <p className="text-lg sm:text-xl">Bring your favorite stories to life with the voices of the people you love.</p>
          </div>
        </section>

        <section aria-label="Plans" className="bg-sunshine/35 px-4 pb-14 sm:px-6">
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-[1.25fr_1fr]">
            <article
              aria-labelledby="plan-family"
              data-testid="plan-family"
              className="flex flex-col gap-5 rounded-[var(--radius-panel)] border-[3px] border-ink bg-surface p-6 shadow-[6px_8px_0_rgba(40,53,72,0.15)] sm:p-8"
            >
              <div className="flex flex-col gap-1">
                <h2 id="plan-family" className="font-display text-3xl font-semibold">
                  Readli Family
                </h2>
                <p className="font-display text-4xl font-semibold">
                  {dollars(P.familyMonthlyCents)}
                  <span className="text-lg font-normal text-muted">/month</span>
                </p>
                <p className="text-muted">
                  or{" "}
                  <Link href="/signup/family?billing=annual" className="font-semibold text-ink underline underline-offset-4">
                    {dollars(P.familyAnnualCents)}/year
                  </Link>
                  , about {annualSavingsPercent(P)}% less than paying monthly
                </p>
              </div>
              <PlanList items={familyHighlights(P, stories)} />
              <div className="mt-auto flex flex-col gap-2">
                <Link href="/signup/family" className={`${buttonPrimary} w-full`}>
                  Start your family
                </Link>
                <p className="text-center text-sm text-muted">
                  Monthly or yearly, cancel any time.
                  Family accounts open soon, and nothing is charged yet.
                </p>
              </div>
            </article>

            <article
              aria-labelledby="plan-voice"
              data-testid="plan-voice"
              className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-mint/60 p-6 ring-2 ring-ink/10 sm:p-8"
            >
              <div className="flex flex-col gap-1">
                <h2 id="plan-voice" className="font-display text-3xl font-semibold">
                  Readli Voice
                </h2>
                <p className="font-display text-4xl font-semibold">Always free</p>
                <p className="text-muted">Record your voice once. Share it with the families you love.</p>
              </div>
              <PlanList items={VOICE_HIGHLIGHTS} />
              <Link href="/signup/voice" className={`${buttonSecondary} mt-auto w-full`}>
                Share your voice
              </Link>
            </article>
          </div>
        </section>

        <section aria-labelledby="extras-heading" className="px-4 py-14 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <h2 id="extras-heading" className="font-display text-3xl font-semibold sm:text-4xl">
                Room to grow
              </h2>
              <p className="text-lg">Add storytellers or narration only when your family wants them.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <article aria-labelledby="extra-slot" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-lavender/40 p-6 sm:p-8">
                <div className="flex flex-col gap-1">
                  <h3 id="extra-slot" className="font-display text-2xl font-semibold">
                    Add a Family Storyteller
                  </h3>
                  <p className="font-display text-3xl font-semibold">
                    {dollars(P.extraSlotMonthlyCents)}
                    <span className="text-base font-normal text-muted">/month each</span>
                  </p>
                  <p>Make room for Grandma, Grandpa, or another special voice.</p>
                </div>
                <table className="w-full text-left">
                  <caption className="sr-only">Monthly total by number of storytellers</caption>
                  <thead>
                    <tr className="border-b-2 border-ink/15 text-sm text-muted">
                      <th scope="col" className="py-2 font-semibold">
                        Storytellers
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        Per month
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {NARRATOR_EXAMPLES.map((row) => (
                      <tr key={row.who} className="border-b border-ink/10 last:border-0">
                        <td className="py-2">{row.who}</td>
                        <td className="py-2 text-right font-semibold">{dollars(monthlyTotalCents(P, row.count))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article aria-labelledby="extra-credits" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sky/30 p-6 sm:p-8">
                <div className="flex flex-col gap-1">
                  <h3 id="extra-credits" className="font-display text-2xl font-semibold">
                    More Stories, Anytime
                  </h3>
                  <p>Get more narration credits whenever your family wants to prepare another story.</p>
                </div>
                <table className="w-full text-left">
                  <caption className="sr-only">Narration credit packs</caption>
                  <thead>
                    <tr className="border-b-2 border-ink/15 text-sm text-muted">
                      <th scope="col" className="py-2 font-semibold">
                        Credit pack
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        One-time price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {P.creditPacks.map((pack) => (
                      <tr key={pack.credits} className="border-b border-ink/10 last:border-0">
                        <td className="py-2">{pack.credits} credits</td>
                        <td className="py-2 text-right font-semibold">{dollars(pack.priceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm text-muted">Credit packs are for Readli Family households and are used after your monthly credits.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="credits" aria-labelledby="difference-heading" className="scroll-mt-20 bg-mint/40 px-4 py-14 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <h2 id="difference-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              Storytellers and credits are different
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-8">
                <h3 className="font-display text-2xl font-semibold">Storyteller slots: who can read</h3>
                <p>
                  Each family voice your children can hear uses one slot. Readli Family includes {P.includedNarratorSlots}, and you can add
                  more for {dollars(P.extraSlotMonthlyCents)} a month each. Extra slots don&apos;t add narration credits.
                </p>
              </div>
              <div className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-8">
                <h3 className="font-display text-2xl font-semibold">Narration credits: how much new reading</h3>
                <p>
                  One credit prepares {P.charactersPerCredit.toLocaleString("en-US")} characters of new narration, about one minute of reading.
                  Your household shares {P.monthlyCredits} credits a month, enough for about {stories} new picture books in one voice, and they
                  refresh each month. Readli shows exactly how many credits a story needs before you confirm.
                </p>
              </div>
            </div>
            {examples.length > 0 && (
              <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-8" data-testid="credit-examples">
                <h3 className="font-display text-2xl font-semibold">What {P.monthlyCredits} credits read</h3>
                <p>
                  Each story costs credits once for each voice you prepare it in. After that, it plays again for free, as often as your
                  children like.
                </p>
                <table className="w-full text-left">
                  <caption className="sr-only">Credits to prepare example books in one voice</caption>
                  <thead>
                    <tr className="border-b-2 border-ink/15 text-sm text-muted">
                      <th scope="col" className="py-2 font-semibold">
                        Book
                      </th>
                      <th scope="col" className="py-2 font-semibold">
                        Reading time
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        Credits, one voice
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {examples.map((b) => {
                      const credits = bookCredits(b.characters!, P.charactersPerCredit);
                      return (
                        <tr key={b.slug} className="border-b border-ink/10 align-top last:border-0">
                          <td className="py-2 pr-3">
                            <Link href={bookPath(b.slug)} className="underline-offset-4 hover:underline">
                              {b.title}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">About {Math.max(1, Math.round(b.minutes))} min</td>
                          <td className="py-2 text-right font-semibold">
                            {credits}
                            {credits > P.monthlyCredits && (
                              <span className="block text-sm font-normal text-muted">
                                about {monthsOfCredits(credits, P.monthlyCredits)} months, a chapter at a time
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-sm text-muted">
                  Long chapter books can be prepared one chapter at a time, so you only spend credits on what you&apos;ll read next.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-8">
              <h3 className="font-display text-2xl font-semibold">These never use credits</h3>
              <PlanList items={NO_CREDITS} className="sm:grid sm:grid-cols-2" />
            </div>
          </div>
        </section>

        <section aria-labelledby="gift-heading" className="bg-coral/15 px-4 py-14 sm:px-6" data-testid="pricing-gift">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <h2 id="gift-heading" className="font-display text-3xl font-semibold sm:text-4xl">
                Give Readli as a gift
              </h2>
              <p className="text-lg">
                Grandparents often give the stories as well as the voice. Your gift covers Readli Family for up to {SPONSORED.households} of
                your children&apos;s families, and they never enter a card.
              </p>
            </div>
            <ul className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-2">
              {GIFTS.map((g) => (
                <li key={g.id} className="flex flex-col gap-1 rounded-[var(--radius-panel)] bg-surface p-6 text-center">
                  <span className="font-display text-xl font-semibold">{g.name}</span>
                  <span className="font-display text-3xl font-semibold">{g.price}</span>
                  <span className="text-sm text-muted">{g.summary}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col items-center gap-2 text-center">
              <Link href="/gift/family" className={buttonPrimary}>
                Give a gift
              </Link>
              <p className="text-sm text-muted">Families are never charged for your gift. When it ends, each family chooses whether to keep going.</p>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 text-center sm:px-6">
          <p className="text-lg">
            Questions about plans or credits?{" "}
            <Link href="/help/billing-credits-and-gifts" className="font-semibold underline underline-offset-4">
              Visit the Help Center
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
