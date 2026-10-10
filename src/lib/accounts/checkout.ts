/** Paid checkout (Readli Family, extra narrator slots, gifts) stays off until billing is switched on. */
export function familyCheckoutOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEXT_PUBLIC_FAMILY_CHECKOUT_ENABLED === "true";
}
