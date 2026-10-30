import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { DonationRequestForm } from "@/components/donations/DonationRequestForm";
import { HeroBedtimeScene } from "@/components/home/HeroBedtimeScene";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { effectivePlan } from "@/lib/billing/price-settings";
import { money } from "@/lib/donations/program";
import { accountDb } from "@/lib/family/account-store";
import { SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Donation Requests for School Raffles & Charity Auctions | Readli",
  description:
    "Request a complimentary 12-month Readli Family membership for your school's raffle, PTA fundraiser, silent auction, tricky tray, or nonprofit event. Available nationwide.",
  path: "/donations",
});

export const dynamic = "force-dynamic";

const WHO = [
  "Elementary schools, preschools, and other educational programs.",
  "PTAs, PTOs, and school parent organizations.",
  "Public libraries and literacy initiatives.",
  "Registered nonprofit and charitable organizations.",
  "Children's hospitals and family-focused charities.",
  "Community fundraising committees acting on behalf of an eligible organization.",
  "Youth programs and family-serving community organizations.",
];

const EVENTS = ["Raffles", "Silent auctions", "Tricky trays", "Basket dinners", "Fundraising galas", "School fairs"];

const STEPS = [
  { title: "Tell Us About Your Organization", body: "Complete our short donation request form with your organization and event details.", tint: "bg-sunshine" },
  { title: "We Review Your Request", body: "We verify the information and check eligibility. Some requests may need additional documentation.", tint: "bg-mint" },
  { title: "Receive Your Gift Certificate", body: "Once approved, we'll email you a printable Readli Family Annual Membership certificate with a unique redemption code.", tint: "bg-sky" },
  { title: "Make Someone's Day", body: "Include the certificate in your fundraising event. The winning family activates it online and enjoys 12 months of Readli storytelling.", tint: "bg-lavender" },
];

const FAQS: { q: string; a: string }[] = [
  { q: "Does Readli donate to school fundraisers?", a: "Yes. Readli welcomes donation requests from eligible schools, PTAs, PTOs, and other educational organizations throughout the United States." },
  { q: "What does Readli donate?", a: "An eligible fundraiser may receive a complimentary 12-month Readli Family membership certificate to use as an auction or raffle prize." },
  { q: "Is there a cost to request a donation?", a: "No. Applying for a Readli donation is free." },
  { q: "Can we request a donation for a tricky tray or basket dinner?", a: "Yes. These events are eligible when they benefit a qualifying school, charitable organization, or community cause." },
  { q: "Do you provide physical products?", a: "No. Donations are delivered digitally as printable membership gift certificates." },
  { q: "How long does the winning family have to redeem the gift?", a: "The certificate displays its redemption deadline. The standard deadline is 12 months after the fundraising event." },
  {
    q: "Can our organization apply for multiple events?",
    a: "Yes. Organizations may request donations for multiple legitimate events. Duplicate requests for the same event will not result in additional certificates without special approval.",
  },
  { q: "Is a credit card required to claim the gift?", a: "No. The complimentary annual membership does not require payment information and will not automatically renew as a paid subscription." },
  { q: "Our PTA doesn't have its own EIN. Can we still apply?", a: "Yes. Tell us about your school or the cause your event supports, and we'll find another way to confirm your organization." },
];

const NARRATORS = [
  { name: "Mom", avatar: "mom", place: "flex left-2 top-4 sm:left-4" },
  { name: "Grandpa", avatar: "grandpa", place: "flex right-2 top-0 sm:right-6" },
  { name: "Aunt Pook", avatar: "pook", place: "hidden sm:flex left-5 bottom-5" },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-mint-deep" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.16" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A family listening together, with the voices of the people they love around them. */
function HeroArt() {
  return (
    <div role="img" aria-label="A family listening to a bedtime story together, read in the voices of Mom, Grandpa and Aunt Pook." className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="overflow-hidden rounded-[28px] shadow-[0_24px_50px_-22px_rgba(40,53,72,0.45)]">
        <HeroBedtimeScene className="block h-[280px] w-full sm:h-[360px] lg:h-[460px]" />
      </div>
      {NARRATORS.map((n) => (
        <div key={n.name} className={`absolute items-center gap-2 rounded-full bg-surface/95 py-1 pr-3.5 pl-1 shadow-lg ${n.place}`}>
          <Image src={`/family-voices/${n.avatar}.webp`} alt="" width={48} height={48} className="size-10 rounded-full sm:size-12" />
          <span className="font-display text-sm font-semibold sm:text-base">{n.name}</span>
        </div>
      ))}
      <div className="absolute right-3 bottom-3 flex items-center gap-2 rounded-2xl bg-sunshine px-4 py-2.5 shadow-lg sm:right-5 sm:bottom-5">
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z" />
        </svg>
        <span className="font-display text-base font-semibold">12 months of stories</span>
      </div>
    </div>
  );
}

/**
 * Readli Gives Back (Kevin's spec, 2026-10-30): the public page where schools, PTAs, libraries and
 * nonprofits request a complimentary annual Readli Family membership for their fundraiser. The plan
 * facts come from the live plan settings, so the page never disagrees with /pricing.
 */
export default async function DonationsPage() {
  const plan = await effectivePlan(accountDb());
  const retail = money(plan.familyAnnualPriceCents);
  const features = [
    "Access to the full Readli Family experience and the whole storybook library.",
    `Up to ${plan.maxChildProfiles} child profiles.`,
    "Personalized storytelling with eligible narrators.",
    "The ability to invite loved ones to contribute their voices.",
    `${plan.includedNarratorSlots} active saved family narrators, subject to voice-owner authorization and parental approval.`,
    "Family-friendly listening and the Readli Kids features included in the standard Family plan.",
  ];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl("/donations"),
        url: absoluteUrl("/donations"),
        name: "Readli Gives Back: donation requests for school raffles and charity auctions",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />

        <section aria-labelledby="gives-heading" className="relative overflow-hidden bg-ivory">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-[40%] top-[35%] h-[70%] w-[140%] rounded-full bg-[radial-gradient(closest-side,#fde8b8_0%,#fff1d6_55%,rgba(255,249,237,0)_100%)] lg:-top-[10%] lg:-right-[12%] lg:h-[120%] lg:w-[62%]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:pt-16 lg:pb-20">
            <div className="flex flex-col gap-5 text-center lg:text-left">
              <p className="text-sm font-extrabold tracking-[0.16em] text-coral-deep uppercase">Readli Gives Back</p>
              <h1 id="gives-heading" className="font-display text-[40px] leading-[1.08] font-semibold sm:text-5xl lg:text-[56px]">
                Helping Good Causes Tell Great Stories.
              </h1>
              <p className="text-lg leading-relaxed sm:text-xl">At Readli, we believe every family deserves more moments together through the magic of storytelling.</p>
              <p className="text-lg leading-relaxed">
                That&apos;s why we&apos;re proud to support schools, PTAs, PTOs, nonprofit organizations, and community fundraisers across the country with complimentary annual
                Readli Family memberships.
              </p>
              <p className="text-lg leading-relaxed">
                Whether you&apos;re hosting a school raffle, basket auction, tricky tray, charity dinner, or fundraising event, we&apos;d love to help make it special.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link href="#request" className={`${buttonPrimary} w-full sm:w-auto`} data-testid="donations-cta">
                  Request a Donation
                </Link>
                <Link href="#included" className={`${buttonSecondary} w-full sm:w-auto`}>
                  See What&apos;s Included
                </Link>
              </div>
              <p className="text-sm text-muted">Available to eligible organizations throughout the United States. Digital delivery. No shipping required.</p>
            </div>
            <HeroArt />
          </div>
        </section>

        <section id="included" aria-labelledby="included-heading" className="scroll-mt-20 bg-surface px-4 py-12 sm:px-6 lg:py-20">
          <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-extrabold tracking-[0.16em] text-mint-deep uppercase">What we&apos;re donating</p>
              <h2 id="included-heading" className="font-display text-4xl font-semibold sm:text-[44px]">
                A Full Year of Family Storytelling
              </h2>
              <p className="text-lg leading-relaxed">
                A full 12 months of Readli Family membership, so the winning family can discover a more personal way to enjoy stories together.
              </p>
              <p className="text-lg leading-relaxed">
                Gift recipients receive the same included benefits as a regular annual Family subscriber, subject to the membership&apos;s normal content and usage allowances.
              </p>
              <Link href="#request" className={`${buttonPrimary} w-full sm:w-fit`}>
                Apply for a Donation
              </Link>
            </div>
            <div className="flex flex-col gap-4 rounded-[28px] bg-ivory p-6 ring-2 ring-ink/10 sm:p-8" data-testid="donation-package">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl font-semibold">Readli Family Annual Membership</h3>
                <p className="font-semibold">
                  Estimated retail value: <span data-testid="donation-value">{retail}</span>
                </p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-lg">
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1 rounded-2xl bg-mint/40 px-4 py-3">
                <p className="font-semibold">No credit card required to redeem.</p>
                <p>The membership lasts 12 months from activation and does not automatically convert into a paid subscription.</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="who-heading" className="bg-mint/35 px-4 py-12 sm:px-6 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:gap-14">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-extrabold tracking-[0.16em] text-mint-deep uppercase">Who can apply?</p>
              <h2 id="who-heading" className="font-display text-4xl font-semibold sm:text-[44px]">
                Supporting Communities, One Story at a Time
              </h2>
              <p className="text-lg leading-relaxed">Readli welcomes donation requests from qualifying organizations, including:</p>
              <ul className="flex flex-col gap-2">
                {WHO.map((w) => (
                  <li key={w} className="flex gap-2.5 text-lg">
                    <Check />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-5 rounded-[28px] bg-surface p-6 sm:p-8">
              <h3 className="font-display text-2xl font-semibold">Eligible fundraising activities</h3>
              <ul className="flex flex-wrap gap-2">
                {EVENTS.map((e) => (
                  <li key={e} className="rounded-full bg-sunshine/50 px-4 py-2 font-semibold">
                    {e}
                  </li>
                ))}
                <li className="rounded-full bg-ink/5 px-4 py-2">and similar charitable events</li>
              </ul>
              <p className="text-lg leading-relaxed">Organizations must be able to identify the charitable beneficiary and show they&apos;re authorized to request the donation.</p>
              <p className="text-lg leading-relaxed font-semibold">
                We believe giving back shouldn&apos;t depend on where you live. Readli welcomes qualifying donation requests from communities across all 50 states.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="how-heading" className="bg-surface px-4 py-12 sm:px-6 lg:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <div className="flex flex-col gap-3 text-center">
              <p className="text-sm font-extrabold tracking-[0.16em] text-coral-deep uppercase">How it works</p>
              <h2 id="how-heading" className="font-display text-4xl font-semibold sm:text-[44px]">
                Requesting a Donation Is Easy
              </h2>
            </div>
            <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-3 rounded-[28px] bg-ivory p-6">
                  <span className={`grid size-14 place-items-center rounded-full font-display text-2xl font-semibold ${s.tint}`}>{i + 1}</span>
                  <h3 className="font-display text-xl font-semibold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="request" aria-labelledby="request-heading" className="scroll-mt-20 bg-sunshine/30 px-4 py-12 sm:px-6 lg:py-20">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-3 text-center">
              <p className="text-sm font-extrabold tracking-[0.16em] text-coral-deep uppercase">Donation request</p>
              <h2 id="request-heading" className="font-display text-4xl font-semibold sm:text-[44px]">
                Tell Us About Your Fundraiser
              </h2>
              <p className="text-lg leading-relaxed">We&apos;d love to support your event. Share a few details so we can review your request and prepare your donation certificate.</p>
            </div>
            <DonationRequestForm />
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="bg-surface px-4 py-12 sm:px-6 lg:py-20">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <h2 id="faq-heading" className="text-center font-display text-4xl font-semibold sm:text-[44px]">
              Frequently Asked Questions
            </h2>
            <div className="flex flex-col gap-3">
              {FAQS.map((f) => (
                <details key={f.q} className="rounded-2xl bg-ivory px-5 py-4 ring-2 ring-ink/10">
                  <summary className="cursor-pointer font-display text-lg font-semibold">{f.q}</summary>
                  <p className="mt-2 text-lg leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="program-terms" aria-labelledby="terms-heading" className="scroll-mt-20 bg-ivory px-4 py-10 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 text-[15px] leading-relaxed">
            <h2 id="terms-heading" className="font-display text-2xl font-semibold">
              Readli Gives Back program terms
            </h2>
            <p>
              Each approved event receives one certificate for one 12-month Readli Family membership. Certificates are single-use, have no cash value, and may not be sold,
              resold or exchanged for cash outside the approved fundraising event. The redemption deadline is printed on the certificate and is normally 12 months after the
              event.
            </p>
            <p>
              The membership starts when the winning family redeems it, needs no payment card, and does not renew as a paid subscription. If the winner already pays for
              Readli Family, their paid plan is paused for the gifted year so they don&apos;t lose paid time. Additional paid credits and add-ons are not included.
              Voice-owner permission and parental controls always apply.
            </p>
            <p>
              Approval isn&apos;t guaranteed. Readli may ask for more information, decline requests that don&apos;t meet the program&apos;s eligibility rules, revoke unused
              certificates issued through misuse, and change these terms for future requests. We use the details you send only to review your request and run the program,
              as described in our{" "}
              <Link href="/privacy" className="font-semibold underline underline-offset-4">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
