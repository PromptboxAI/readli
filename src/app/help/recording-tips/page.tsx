import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { SiteFooter } from "@/components/home/sections";
import { SiteHeader } from "@/components/home/SiteHeader";
import { RecordingTipsContent } from "@/components/teleprompter/RecordingTips";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Tips for a better voice recording | Readli Help Center",
  description: "How to record a Readli voice that sounds like you: about 1 to 2 minutes, your natural storytime voice, a quiet room and a steady mic.",
  path: "/help/recording-tips",
});

type Search = Promise<{ from?: string }>;

/** The recording guidance as its own page, for links from help articles and emails. */
export default async function RecordingTipsPage({ searchParams }: { searchParams: Search }) {
  const { from } = await searchParams;
  const back = from === "voice" ? { href: "/voice/record", label: "Back to recording my voice" } : { href: "/try", label: "Back to recording" };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
        <RecordingTipsContent />
        <Link href={back.href} className={`${buttonPrimary} w-fit`}>
          {back.label}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
