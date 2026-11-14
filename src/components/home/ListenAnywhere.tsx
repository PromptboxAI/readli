import Link from "next/link";
import type { ReactNode } from "react";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * What the players already do, said where families decide (SleepyTale review, 2026-11). Each claim
 * matches a published Help Center answer, which it links to, so the page never promises more than the
 * app does.
 */
export const LISTENING_FEATURES: { title: string; body: string; href: string; tint: string; icon: ReactNode }[] = [
  {
    title: "A sleep timer",
    body: "Stop after 15, 30 or 45 minutes, or at the end of the chapter. It keeps going when the screen locks.",
    href: "/help/books-and-listening/sleep-timer-and-speed",
    tint: "bg-lavender/70",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      </svg>
    ),
  },
  {
    title: "Screen down, story on",
    body: "Lock the phone and the story keeps playing. The lock screen shows the cover and who's reading, like \"Read by Grandma\".",
    href: "/help/books-and-listening/listen-in-the-car",
    tint: "bg-sky/60",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M10.5 9.5v5l4-2.5z" />
      </svg>
    ),
  },
  {
    title: "In the car or on a speaker",
    body: "Play through the car by Bluetooth, or AirPlay to a speaker. Steering-wheel and headphone buttons pause and skip.",
    href: "/help/books-and-listening/listen-in-the-car",
    tint: "bg-sunshine/60",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <path d="M5 16V11l2-5h10l2 5v5" />
        <path d="M3.5 16h17v2.5h-17z" />
        <circle cx="7.5" cy="13" r="1" />
        <circle cx="16.5" cy="13" r="1" />
      </svg>
    ),
  },
  {
    title: "Download for the trip",
    body: "Save a story at home and it plays on the plane, with no internet, in the same family voice.",
    href: "/help/books-and-listening/listen-offline",
    tint: "bg-mint",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
        <path d="M5 19.5h14" />
      </svg>
    ),
  },
  {
    title: "Read along",
    body: "Early readers can follow the words, with each sentence lit up as it's read, or keep the screen dark for sleep.",
    href: "/readli-kids",
    tint: "bg-coral/25",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <path d="M3 5.5c3-1.3 6-1.3 9 .5 3-1.8 6-1.8 9-.5V19c-3-1.3-6-1.3-9 .5-3-1.8-6-1.8-9-.5z" />
        <path d="M12 6v13.5" />
      </svg>
    ),
  },
  {
    title: "Phones, tablets and computers",
    body: "Works in the browser on iPhone, iPad, Android, Fire tablets and computers. Add Readli Kids to the home screen like an app.",
    href: "/help/getting-started/readli-kids-on-ipad",
    tint: "bg-lavender/40",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <rect x="2.5" y="4" width="13" height="10" rx="1.5" />
        <path d="M6 17.5h6" />
        <rect x="16" y="8" width="5.5" height="11" rx="1.5" />
      </svg>
    ),
  },
];

/** Homepage band: where and how a family listens, after the library shelf. */
export function ListenAnywhere() {
  return (
    <section id="listen-anywhere" aria-labelledby="listen-heading" className="scroll-mt-20 bg-ivory" data-testid="listen-anywhere">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-14">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="listen-heading" className="font-display text-3xl font-semibold sm:text-4xl">
            Bedtime, wherever it happens
          </h2>
          <p className="text-lg">At home, at Grandma&apos;s, in the car or on a plane, the stories go where your kids go.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LISTENING_FEATURES.map((f) => (
            <li key={f.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-5 sm:p-6 ${f.tint}`}>
              <span className="grid size-11 place-items-center rounded-full bg-surface/80 text-ink" aria-hidden="true">
                {f.icon}
              </span>
              <h3 className="font-display text-xl font-semibold">{f.title}</h3>
              <p className="text-[15px] text-ink/85 sm:text-base">{f.body}</p>
              <Link href={f.href} className="mt-auto inline-flex min-h-11 w-fit items-center text-sm font-semibold underline underline-offset-4">
                How it works<span className="sr-only">: {f.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
