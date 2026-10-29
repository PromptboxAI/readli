/** Shared pill button classes. Brief §2: 48px+ targets, chunky rounded pills. */
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-display text-lg font-semibold transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonPrimary = `${base} bg-coral-deep text-white shadow-[0_4px_0_#8f2a1e] hover:-translate-y-0.5`;
export const buttonSecondary = `${base} border-[3px] border-ink bg-surface text-ink hover:-translate-y-0.5`;
export const buttonQuiet = `${base} bg-transparent text-ink underline-offset-4 hover:underline`;

/** Smaller pills for settings rows, still a 44px target. */
const small =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 font-display text-base font-semibold whitespace-nowrap transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonSmall = `${small} border-[3px] border-ink bg-surface text-ink hover:-translate-y-0.5`;
export const buttonSmallPrimary = `${small} bg-coral-deep text-white shadow-[0_3px_0_#8f2a1e] hover:-translate-y-0.5`;
export const buttonSmallQuiet = `${small} bg-transparent px-2 text-ink underline underline-offset-4`;
