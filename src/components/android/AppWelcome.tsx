import Image from "next/image";
import Link from "next/link";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";

/**
 * The signed-out start screen inside the Android app (Kevin, 2026-11-17). The app opens on Family Home,
 * and a signed-out visitor there would otherwise see the website's header, banner and footer. It covers
 * the whole screen and only shows in the app ([data-app-only] in globals.css), so the website is unchanged.
 */
export function AppWelcome({ next }: { next: string }) {
  return (
    <div
      data-app-only
      data-testid="app-welcome"
      className="fixed inset-0 z-[100] flex-col items-center justify-between overflow-y-auto bg-ivory px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))] text-center"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <Image src="/brand/readi-icon.webp" alt="" width={132} height={90} priority />
        <h1 className="font-display text-5xl font-semibold tracking-tight">Readli</h1>
        <p className="max-w-xs text-xl">Bedtime stories, read in the voices your kids love.</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${parentPrimary} w-full`}>
          Log in
        </Link>
        <Link href="/signup" className={`${parentSecondary} w-full`}>
          New to Readli? Create an account
        </Link>
      </div>
    </div>
  );
}
