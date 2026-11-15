import { TESTIMONIALS } from "@/lib/content/testimonials";

const TONES = ["bg-sunshine/45", "bg-mint/45", "bg-lavender/45"];
const TILT = ["sm:-rotate-1", "sm:rotate-1", "sm:-rotate-[0.5deg]"];

/** What families say, in their own words (lib/content/testimonials.ts). */
export function Testimonials({ heading = "What families are saying", className = "" }: { heading?: string; className?: string }) {
  return (
    <section aria-labelledby="testimonials-heading" className={`px-4 py-14 sm:px-6 ${className}`} data-testid="testimonials">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <h2 id="testimonials-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
          {heading}
        </h2>
        <ul className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <li key={t.name}>
              <figure className={`flex h-full flex-col justify-between gap-4 rounded-[var(--radius-panel)] p-6 shadow-[3px_4px_0_rgba(40,53,72,0.12)] ${TONES[i % TONES.length]} ${TILT[i % TILT.length]}`}>
                <blockquote className="font-display text-2xl leading-snug font-semibold">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption>
                  <span className="block font-bold">{t.name}</span>
                  <span className="block text-ink/75">{t.who}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
