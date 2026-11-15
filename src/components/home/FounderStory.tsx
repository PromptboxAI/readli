import Image from "next/image";
import Link from "next/link";
import { FOUNDERS } from "@/lib/content/company";

/** "Why I built Readli": Kevin's story on the homepage (Remento compare, 2026-11-15). Full page at /about. */
export function FounderStory() {
  const founder = FOUNDERS[0];
  if (!founder) return null;
  return (
    <section aria-labelledby="founder-story-heading" className="bg-lavender/20 px-4 py-14 sm:px-6" data-testid="home-founder-story">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {founder.photo && (
          <div className="relative mx-auto w-full max-w-sm">
            <span className="absolute -top-4 -left-4 size-20 rounded-full bg-coral/40" aria-hidden="true" />
            <Image
              src={founder.photo}
              alt={founder.photoAlt}
              width={526}
              height={525}
              className="relative aspect-square w-full -rotate-1 rounded-[32px] border-4 border-ink object-cover shadow-[6px_8px_0_rgba(40,53,72,0.18)]"
            />
          </div>
        )}
        <div className="flex flex-col gap-4">
          <h2 id="founder-story-heading" className="font-display text-3xl font-semibold sm:text-4xl">
            Why I built Readli
          </h2>
          {founder.story.map((p) => (
            <p key={p} className="text-lg leading-relaxed">
              {p}
            </p>
          ))}
          <p className="font-display text-xl font-semibold">
            {founder.name}, <span className="font-normal text-muted">{founder.title}</span>
          </p>
          <Link href="/about" className="font-semibold underline underline-offset-4">
            More about us
          </Link>
        </div>
      </div>
    </section>
  );
}
