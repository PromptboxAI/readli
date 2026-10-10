import type { Metadata } from "next";
import { Fragment } from "react";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import {
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_INTRO,
  PRIVACY_IS_DRAFT,
  PRIVACY_SECTIONS,
} from "@/lib/content/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy | Readli",
  description: "How Readli collects, uses, shares and protects family, child and voice information.",
};

/** Highlights launch placeholders like [PRIVACY EMAIL] so they are easy to spot before publishing. */
function WithPlaceholders({ text }: { text: string }) {
  return text.split(/(\[[A-Z][A-Z -]*\])/).map((part, i) =>
    /^\[[A-Z][A-Z -]*\]$/.test(part) ? (
      <mark key={i} className="rounded bg-sunshine/60 px-1 text-ink">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-14 sm:px-6">
        <header className="flex flex-col gap-4">
          <p className="font-display text-lg font-semibold text-coral-deep">Readli.ai LLC</p>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Privacy Policy</h1>
          <p className="text-muted">
            Effective date: {PRIVACY_EFFECTIVE_DATE}
            {PRIVACY_IS_DRAFT && (
              <span className="ml-2 inline-block rounded-full bg-sunshine px-3 py-0.5 text-sm font-bold text-ink">Draft</span>
            )}
          </p>
          {PRIVACY_INTRO.map((p) => (
            <p key={p} className="text-lg">
              <WithPlaceholders text={p} />
            </p>
          ))}
        </header>

        <nav aria-labelledby="privacy-contents" className="rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10">
          <h2 id="privacy-contents" className="font-display text-xl font-semibold">
            Contents
          </h2>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {PRIVACY_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline-offset-4 hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {PRIVACY_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="flex scroll-mt-24 flex-col gap-4">
            <h2 id={`${s.id}-heading`} className="font-display text-2xl font-semibold sm:text-3xl">
              {s.title}
            </h2>
            {s.paragraphs.map((p) => (
              <p key={p.text} className="leading-relaxed">
                {p.lead && <strong className="font-bold">{p.lead}: </strong>}
                <WithPlaceholders text={p.text} />
              </p>
            ))}
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
