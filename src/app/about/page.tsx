import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { Testimonials } from "@/components/home/Testimonials";
import { PageLd } from "@/components/seo/PageLd";
import { ORGANIZATION_ID, organizationNode, websiteNode } from "@/lib/seo/organization";
import { COMPANY, FOUNDERS, PROMISES } from "@/lib/content/company";
import { publicPageMetadata } from "@/lib/seo/site";
import { PAGE_TITLES } from "@/lib/seo/titles";

const DESCRIPTION = "Readli started with one family: a dad who wanted his kids to fall asleep to the voices of the people who love them. Here's our story and what we believe.";

export const metadata: Metadata = publicPageMetadata({ title: PAGE_TITLES.about, description: DESCRIPTION, path: "/about" });

const STEPS = [
  { title: "Record a minute", body: "Grandma, Grandpa or anyone in the family reads a short script on their phone. No app to install and no tech skills needed.", tone: "bg-sunshine/50" },
  { title: "Share it with family", body: "They choose which families can use their voice, and each family's parents choose which children hear it.", tone: "bg-mint/50" },
  { title: "Kids pick a story", body: "Classic storybooks are read aloud in that familiar voice, at bedtime or any time.", tone: "bg-sky/40" },
];

/** About Us (Kevin, 2026-11-15): the founder's story and family photo, what we believe, and how it works. Company details stay on /company. */
export default function AboutPage() {
  const founder = FOUNDERS[0];
  return (
    <>
      <SiteHeader />
      <main>
        <PageLd path="/about" title={PAGE_TITLES.about} description={DESCRIPTION} type="AboutPage" extra={{ about: { "@id": ORGANIZATION_ID }, mainEntity: { "@id": ORGANIZATION_ID } }} graph={[organizationNode(), websiteNode()]} />
        <section aria-labelledby="about-heading" className="bg-sunshine/35 px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-5">
              <p className="font-display text-lg font-semibold text-coral-deep">About us</p>
              <h1 id="about-heading" className="font-display text-4xl leading-tight font-semibold sm:text-6xl">
                We built Readli for our own bedtime
              </h1>
              <p className="max-w-xl text-xl leading-relaxed">
                Readli started with one family: three kids, and the people who love them but can&apos;t always be there at bedtime.
              </p>
            </div>
            {founder?.photo && (
              <div className="relative mx-auto w-full max-w-md">
                <span className="absolute -top-4 -left-4 size-24 rounded-full bg-coral/40" aria-hidden="true" />
                <span className="absolute -right-3 -bottom-5 size-20 rounded-full bg-sky/60" aria-hidden="true" />
                <Image
                  src={founder.photo}
                  alt={founder.photoAlt}
                  width={526}
                  height={525}
                  priority
                  className="relative aspect-square w-full rotate-1 rounded-[32px] border-4 border-ink object-cover shadow-[6px_8px_0_rgba(40,53,72,0.18)]"
                />
              </div>
            )}
          </div>
        </section>

        {founder && (
          <section aria-labelledby="story-heading" className="px-4 py-14 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              <h2 id="story-heading" className="font-display text-3xl font-semibold sm:text-4xl">
                Our story
              </h2>
              {founder.story.map((p) => (
                <p key={p} className="text-xl leading-relaxed">
                  {p}
                </p>
              ))}
              <p className="font-display text-xl font-semibold">
                {founder.name}
<span className="block font-normal text-muted">{founder.title}</span>
              </p>
            </div>
          </section>
        )}

        <section aria-labelledby="believe-heading" className="bg-mint/35 px-4 py-14 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <h2 id="believe-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              What we believe
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {PROMISES.map((p) => (
                <li key={p} className="rounded-[var(--radius-panel)] bg-surface p-6 text-lg ring-2 ring-ink/10">
                  {p}
                </li>
              ))}
            </ul>
            <p className="text-center">
              <Link href="/parents/safety" className="font-semibold underline underline-offset-4">
                How we keep family voices safe
              </Link>
            </p>
          </div>
        </section>

        <section aria-labelledby="works-heading" className="px-4 py-14 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <h2 id="works-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              How Readli works
            </h2>
            <ol className="grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${s.tone}`}>
                  <span className="grid size-10 place-items-center rounded-full bg-surface font-display text-xl font-semibold ring-2 ring-ink">{i + 1}</span>
                  <h3 className="font-display text-2xl font-semibold">{s.title}</h3>
                  <p className="text-lg">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Testimonials className="bg-lavender/20" />

        <section className="bg-sunshine px-4 py-14 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Hear a story in your own voice</h2>
            <p className="text-lg">It takes about a minute, and it&apos;s free to try.</p>
            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
                Try it free
              </Link>
              <Link href="/how-it-works" className={`${buttonSecondary} w-full sm:w-auto`}>
                See how it works
              </Link>
            </div>
            <p className="text-ink/80">
              Questions? Write to us at{" "}
              <a href={`mailto:${COMPANY.email}`} className="font-semibold underline underline-offset-4">
                {COMPANY.email}
              </a>
              . We&apos;d love to hear from you.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
