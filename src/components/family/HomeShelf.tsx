import Image from "next/image";
import Link from "next/link";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import type { HomeBook, HomeStoryteller } from "@/lib/family/home";

/** A titled row of book covers that scrolls sideways, like a shelf. */
export function BookShelf({ id, title, books, more }: { id: string; title: React.ReactNode; books: HomeBook[]; more?: { href: string; label: string } }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-h`} data-testid={`shelf-${id}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        {more && (
          <Link href={more.href} className="shrink-0 font-display font-semibold text-coral-deep underline-offset-4 hover:underline">
            {more.label}
          </Link>
        )}
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {books.map((b) => (
          <li key={`${b.slug}-${b.detail}`} className="w-36 shrink-0 snap-start sm:w-40">
            <Link href={b.href} className="flex flex-col gap-2 rounded-2xl" data-testid={`home-book-${b.slug}`}>
              <span className="relative block overflow-hidden rounded-2xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)]">
                {b.coverUrl ? (
                  <Image src={b.coverUrl} alt="" width={160} height={213} className="aspect-[3/4] w-full object-cover" />
                ) : (
                  <span className={`flex aspect-[3/4] w-full items-center justify-center p-3 text-center font-display text-lg font-semibold ${b.tint}`}>{b.title}</span>
                )}
                {b.voices.length > 0 && (
                  <span className="absolute bottom-2 left-2 flex -space-x-2" aria-hidden="true">
                    {b.voices.slice(0, 3).map((v) => (
                      <StorytellerAvatar key={v.name} name={v.name} avatarUrl={v.avatarUrl} tint={v.tint} size="xs" />
                    ))}
                  </span>
                )}
                {b.percent !== null && (
                  <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/60" aria-hidden="true">
                    <span className="block h-full bg-coral" style={{ width: `${b.percent}%` }} />
                  </span>
                )}
              </span>
              <span className="font-display font-semibold leading-tight">{b.title}</span>
              <span className="text-sm leading-snug text-muted">{b.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TONE: Record<HomeStoryteller["tone"], string> = {
  family: "bg-sunshine/40",
  some: "bg-mint/40",
  none: "bg-sky/30",
  waiting: "bg-lavender/40",
};

/** The family's storytellers at a glance, each with who may hear them. */
export function StorytellerRow({ storytellers }: { storytellers: HomeStoryteller[] }) {
  return (
    <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" data-testid="home-storytellers">
      {storytellers.map((s) => (
        <li key={s.voiceId} className="shrink-0">
          <Link href="/family/narrators" className={`flex w-60 items-center gap-3 rounded-3xl p-3 ${TONE[s.tone]}`}>
            <StorytellerAvatar name={s.person.name} avatarUrl={s.person.avatarUrl} tint={s.person.tint} muted={s.tone === "waiting"} />
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-lg font-semibold">{s.person.name}</span>
              <span className="text-sm text-muted">{s.detail}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
