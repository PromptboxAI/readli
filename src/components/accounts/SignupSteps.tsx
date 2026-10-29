import { ACCOUNT_TYPES } from "@/lib/accounts/accounts";

/** A numbered step heading for family signup: a big dark number, then the step in plain words. */
export function StepHeading({ n, id, children }: { n: number; id: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-ink font-display text-xl font-semibold text-surface">
        {n}
      </span>
      <h2 id={id} className="font-display text-2xl font-semibold sm:text-3xl">
        <span className="sr-only">Step {n}: </span>
        {children}
      </h2>
    </div>
  );
}

/** What Readli Family includes, shown inside step 1 so the list sits right beside the price it explains. */
export function PlanIncludes() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 sm:p-6">
      <p className="text-lg font-bold">Both plans include everything:</p>
      <ul className="grid gap-x-6 gap-y-2.5 text-lg sm:grid-cols-2">
        {ACCOUNT_TYPES.family.includes.map((t) => (
          <li key={t} className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-mint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            {t}
          </li>
        ))}
      </ul>
      <p className="text-muted">There&apos;s no extra charge for each child. After checkout you&apos;ll name your family and add your children&apos;s profiles.</p>
    </div>
  );
}

const icon = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Three short reassurances under the steps. */
export function SignupReassurance() {
  return (
    <ul className="grid gap-3 text-lg font-semibold sm:grid-cols-3">
      <li className="flex items-center gap-3">
        <svg aria-hidden="true" {...icon} className="shrink-0 text-mint-deep">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Secure checkout
      </li>
      <li className="flex items-center gap-3">
        <svg aria-hidden="true" {...icon} className="shrink-0 text-mint-deep">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l3 3 5-6" />
        </svg>
        Cancel any time
      </li>
      <li className="flex items-center gap-3">
        <svg aria-hidden="true" {...icon} className="shrink-0 text-mint-deep">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
          <circle cx="17" cy="9.5" r="2.5" />
          <path d="M16 14.2c2.8.2 5 2.4 5 5.8" />
        </svg>
        No charge per child
      </li>
    </ul>
  );
}
