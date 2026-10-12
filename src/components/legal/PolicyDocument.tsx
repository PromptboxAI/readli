import { Fragment } from "react";
import { LEGAL_REVIEW_PENDING } from "@/lib/content/legal-status";
import type { PolicySection } from "@/lib/content/privacy-policy";

const TOKEN = /(\[[A-Z][A-Z -]*\]|[\w.+-]+@[\w-]+\.[\w.]+\w|https:\/\/[^\s]+\w)/;

/** Links emails and URLs, and highlights any bracketed placeholder so it cannot go out unnoticed. */
function RichText({ text }: { text: string }) {
  return text.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    if (part.startsWith("["))
      return (
        <mark key={i} className="rounded bg-sunshine/60 px-1 text-ink">
          {part}
        </mark>
      );
    return (
      <a key={i} href={part.includes("@") ? `mailto:${part}` : part} className="font-semibold underline underline-offset-4">
        {part}
      </a>
    );
  });
}

/** Shared layout for Readli's legal pages: title, effective date, intro, contents and numbered sections. */
export function PolicyDocument({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: PolicySection[];
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-4">
        <p className="font-display text-lg font-semibold text-coral-deep">Readli.ai LLC</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{title}</h1>
        <p className="text-muted">
          Effective date: {effectiveDate}
          {LEGAL_REVIEW_PENDING && (
            <span className="ml-2 inline-block rounded-full bg-sunshine px-3 py-0.5 text-sm font-bold text-ink" data-testid="legal-review">
              Under legal review
            </span>
          )}
        </p>
        {intro.map((p) => (
          <p key={p} className="text-lg">
            <RichText text={p} />
          </p>
        ))}
      </header>

      <nav aria-labelledby="policy-contents" className="rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10">
        <h2 id="policy-contents" className="font-display text-xl font-semibold">
          Contents
        </h2>
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="underline-offset-4 hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="flex scroll-mt-24 flex-col gap-4">
          <h2 id={`${s.id}-heading`} className="font-display text-2xl font-semibold sm:text-3xl">
            {s.title}
          </h2>
          {s.paragraphs.map((p) => (
            <p key={p.text} className="leading-relaxed">
              {p.lead && <strong className="font-bold">{p.lead}: </strong>}
              <RichText text={p.text} />
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
