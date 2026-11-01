import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/help/PrintButton";
import { HANDOUTS, getHandout } from "@/lib/help/handouts";
import { publicPageMetadata, SITE_URL } from "@/lib/seo/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return HANDOUTS.map((h) => ({ handout: h.slug }));
}

type Params = Promise<{ handout: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const h = getHandout((await params).handout);
  if (!h) return {};
  return publicPageMetadata({ title: `${h.title} | Readli printable guide`, description: h.intro, path: `/help/print/${h.slug}` });
}

/**
 * A one-page printable guide, in large type, for someone who'd rather follow steps on paper: a
 * grandparent recording their voice, or a parent setting up a tablet. The page prints without the
 * site's header, footer or buttons.
 */
export default async function HandoutPage({ params }: { params: Params }) {
  const h = getHandout((await params).handout);
  if (!h) notFound();
  const host = SITE_URL.replace(/^https?:\/\//, "");
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10 text-ink print:max-w-none print:gap-4 print:p-0" data-testid="handout">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/help" className="font-semibold underline underline-offset-4">
          Back to Help
        </Link>
        <PrintButton />
      </div>
      <header className="flex flex-col gap-2 border-b-2 border-ink/15 pb-4">
        <p className="font-display text-lg font-semibold text-coral-deep">Readli</p>
        <h1 className="font-display text-4xl leading-tight font-semibold">{h.title}</h1>
        <p className="text-xl">{h.intro}</p>
      </header>
      <ol className="flex flex-col gap-4">
        {h.steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 break-inside-avoid">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sunshine font-display text-xl font-bold print:border-2 print:border-ink">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
              <p className="text-lg leading-relaxed">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <footer className="border-t-2 border-ink/15 pt-4 text-lg">
        {h.footer} More help: <strong>{host}/help</strong>
      </footer>
    </main>
  );
}
