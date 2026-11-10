import Link from "next/link";
import { START_STEP_LABELS, START_STEPS, startHref, type StartStep } from "@/lib/onboarding/start";

/** The welcome's progress: five short steps, each a link back, with the ones done ticked. */
export function StartStepper({ step, done }: { step: StartStep; done: Partial<Record<StartStep, boolean>> }) {
  const at = START_STEPS.indexOf(step);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold tracking-wider text-muted uppercase" data-testid="start-progress">
        Getting started · Step {at + 1} of {START_STEPS.length}
      </p>
      <nav aria-label="Getting started steps">
        <ol className="grid grid-cols-5 gap-2" data-testid="start-stepper">
          {START_STEPS.map((s, i) => {
            const current = s === step;
            const ok = Boolean(done[s]) && !current;
            return (
              <li key={s} className="min-w-0">
                <Link href={startHref(s)} aria-current={current ? "step" : undefined} className="flex flex-col gap-1.5 rounded-xl p-1 text-sm hover:bg-ink/5">
                  <span
                    className={`rounded-full ${current ? "h-3" : "h-2"} ${ok ? "bg-mint" : current ? "bg-coral-deep" : i < at ? "bg-mint/60" : "bg-ink/15"}`}
                    aria-hidden="true"
                  />
                  <span className={`truncate ${current ? "font-semibold" : "text-muted"}`}>
                    <span aria-hidden="true">{ok ? "✓ " : `${i + 1}. `}</span>
                    {START_STEP_LABELS[s]}
                    {ok && <span className="sr-only"> (done)</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
