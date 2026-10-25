import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { SocialIcon } from "@/components/brand/SocialIcon";
import { COMPANY, COMPANY_ADDRESS, FOUNDERS } from "@/lib/content/company";
import { SOCIAL_ACCOUNTS } from "@/lib/content/social";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Company | Readli",
  description: `About Readli, made by ${COMPANY.legalName} in ${COMPANY.city}, ${COMPANY.region}: who we are, how to reach us, and our official accounts.`,
  path: "/company",
});

const PROMISES = [
  "A voice belongs to the person who recorded it. Only they can share it, and they can stop at any time.",
  "Parents choose which children hear each voice. Every newly shared voice starts switched off.",
  "A voice only reads the storybooks in the Readli library. Nobody can type in their own words for it to say.",
  "Family voices are never made public.",
];

/** Company page: who makes Readli and how to reach them, above the fold for families meeting us cold (Kevin, 2026-10-24). */
export default function CompanyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-14 sm:px-6">
        <section aria-labelledby="about-heading" className="flex flex-col gap-4">
          <p className="font-display text-lg font-semibold text-coral-deep">Every Book. Every Voice.</p>
          <h1 id="about-heading" className="font-display text-4xl font-semibold sm:text-5xl">
            About Readli
          </h1>
          <p className="max-w-2xl text-lg">
            Readli lets families hear classic storybooks read in the voices of the people they love. Parents,
            grandparents, aunts, uncles and family friends each record and approve their own voice, and choose who can
            use it.
          </p>
          <dl className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:grid-cols-2 sm:p-8" data-testid="company-details">
            <div>
              <dt className="text-sm font-semibold text-muted">Made by</dt>
              <dd className="font-display text-xl font-semibold">{COMPANY.legalName}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Where we are</dt>
              <dd>{COMPANY_ADDRESS}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Talk to a person</dt>
              <dd>
                <a href={`mailto:${COMPANY.email}`} className="font-semibold underline underline-offset-4">
                  {COMPANY.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Website</dt>
              <dd>
                <a href="https://readli.ai" className="font-semibold underline underline-offset-4">
                  readli.ai
                </a>
              </dd>
            </div>
          </dl>
        </section>

        {FOUNDERS.length > 0 && (
          <section aria-labelledby="founders-heading" className="flex flex-col gap-6" data-testid="founders">
            <h2 id="founders-heading" className="font-display text-3xl font-semibold">
              Why we built Readli
            </h2>
            {FOUNDERS.map((f) => (
              <article key={f.name} className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {f.photo && (
                  <Image src={f.photo} alt={f.photoAlt} width={240} height={240} className="size-48 shrink-0 rounded-3xl border-[3px] border-ink object-cover sm:size-56" />
                )}
                <div className="flex flex-col gap-3">
                  {f.story.map((p) => (
                    <p key={p} className="text-lg">
                      {p}
                    </p>
                  ))}
                  <p className="font-display text-lg font-semibold">
                    {f.name}, <span className="font-normal text-muted">{f.title}</span>
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}

        <section aria-labelledby="promises-heading" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-mint/40 p-6 sm:p-8">
          <h2 id="promises-heading" className="font-display text-3xl font-semibold">
            Our promises about voices
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            {PROMISES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p>
            Read more about{" "}
            <Link href="/parents/safety" className="font-semibold underline underline-offset-4">
              family privacy &amp; safety
            </Link>{" "}
            or our{" "}
            <Link href="/privacy" className="font-semibold underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="accounts-heading" className="flex flex-col gap-4">
          <h2 id="accounts-heading" className="font-display text-3xl font-semibold">
            Official accounts
          </h2>
          <p className="text-muted">These are Readli&apos;s only official social media accounts.</p>
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="official-accounts">
            {SOCIAL_ACCOUNTS.map((a) => (
              <li key={a.platform}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 transition-transform hover:-translate-y-0.5 hover:ring-ink"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white">
                    <SocialIcon platform={a.platform} className="size-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-semibold">{a.name}</span>
                    <span className="block text-muted">{a.handle}</span>
                    <span className="block truncate text-sm text-muted">{a.url.replace(/^https:\/\/(www\.)?/, "")}</span>
                  </span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
