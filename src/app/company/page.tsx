import type { Metadata } from "next";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { SocialIcon } from "@/components/brand/SocialIcon";
import { SOCIAL_ACCOUNTS } from "@/lib/content/social";

export const metadata: Metadata = {
  title: "Company | Readli",
  description: "About Readli and its official accounts.",
};

/** Company page: who Readli is and its official accounts, kept visible for press and investors. */
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
          <p>
            Website:{" "}
            <a href="https://readli.ai" className="font-semibold underline underline-offset-4">
              readli.ai
            </a>
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
