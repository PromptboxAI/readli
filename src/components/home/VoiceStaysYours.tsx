import Link from "next/link";
import { VOICE_FAQS, VOICE_STAYS_YOURS } from "@/lib/content/voice-stays-yours";

/**
 * "Your voice stays yours" and the "What if Readli goes away?" answers (Kevin, 2026-11-15). The words live
 * in lib/content/voice-stays-yours.ts, which says what backs each line.
 */
export function VoiceStaysYours({ className = "bg-sky/20" }: { className?: string }) {
  return (
    <section id="your-voice-stays-yours" aria-labelledby="voice-stays-heading" className={`scroll-mt-20 px-4 py-14 sm:px-6 ${className}`} data-testid="voice-stays-yours">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 id="voice-stays-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              Your voice stays yours
            </h2>
            <p className="text-lg">A voice belongs to the person who recorded it, not to Readli. Here&apos;s what that means.</p>
          </div>
          <ul className="flex flex-col gap-4">
            {VOICE_STAYS_YOURS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-1.5 size-3 shrink-0 rounded-full bg-coral-deep" aria-hidden="true" />
                <p className="text-lg">
                  <span className="font-display text-xl font-semibold">{p.title}.</span> {p.body}
                </p>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/parents/safety" className="font-semibold underline underline-offset-4">
              How Readli keeps family voices safe
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-2xl font-semibold">Questions families ask</h3>
          {VOICE_FAQS.map((f) => (
            <details key={f.q} id={f.id} className="group scroll-mt-24 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 open:ring-ink/25">
              <summary className="cursor-pointer list-none font-display text-xl font-semibold marker:hidden">
                <span className="flex items-start justify-between gap-3">
                  {f.q}
                  <span className="text-coral-deep transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-lg">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
