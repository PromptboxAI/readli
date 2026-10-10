import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { TeleprompterRecorder } from "@/components/teleprompter/TeleprompterRecorder";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";

export const metadata: Metadata = {
  title: "Record your voice | Readli",
};

/** Dedicated recording screen (Amendment 001 §A): one continuous take, no page changes. */
export default function TryPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Wordmark />
        <Link href="/" className="min-h-11 rounded-full px-3 py-2 font-display font-medium underline-offset-4 hover:underline">
          Exit
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-6 sm:px-6">
        <TeleprompterRecorder script={DEMO_SCRIPT} />
      </main>
    </div>
  );
}
