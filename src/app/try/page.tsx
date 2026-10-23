import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { TeleprompterRecorder } from "@/components/teleprompter/TeleprompterRecorder";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import { currentGuest, effectiveMode, guestDemoDeps } from "@/lib/server/guest-demo";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Hear a story in your voice, free | Readli",
  description: "Record about a minute of your natural storytime voice and hear a classic storybook read aloud the way only you can. Free to try.",
  path: "/try",
});

/** Dedicated recording screen (Amendment 001 §A): one continuous take, no page changes. */
export default async function TryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  // Back from a signup page: reopen the stories in the voice this browser already made.
  let resumeCleanUp: boolean | null = null;
  if (p.resume === "1") {
    const deps = guestDemoDeps();
    const guest = deps && (await effectiveMode(deps).catch(() => "off")) !== "off" ? await currentGuest(deps).catch(() => null) : null;
    if (guest?.hasVoice) resumeCleanUp = p.cleanup === "1";
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Wordmark />
        <Link href="/" className="min-h-11 rounded-full px-3 py-2 font-display font-medium underline-offset-4 hover:underline">
          Exit
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-6 sm:px-6">
        <TeleprompterRecorder script={DEMO_SCRIPT} resumeCleanUp={resumeCleanUp} />
      </main>
    </div>
  );
}
