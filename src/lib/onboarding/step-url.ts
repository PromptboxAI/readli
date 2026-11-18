/**
 * The same page with the step written into its address. A walkthrough opened without ?step= picks the
 * first step still to do; it then redirects here so the step stays put. Otherwise finishing something on
 * that step (adding a first child, keeping a voice) refreshes the page, which picks again and skips ahead.
 */
export function withStep(path: string, query: Record<string, string | string[] | undefined>, step: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key !== "step" && typeof value === "string") params.set(key, value);
  }
  params.set("step", step);
  return `${path}?${params}`;
}
