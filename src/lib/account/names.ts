/**
 * The name a grown-up chose, or null while all we have is the stand-in made from their email
 * address at sign-in (displayName in lib/auth/supabase), which nobody wants to be greeted by.
 * `named` says they gave a name themselves, so it counts even when it matches their email
 * (Kevin at kevin@example.com).
 */
export function chosenName(name: string | null | undefined, email: string | null | undefined, named = false): string | null {
  const n = name?.trim() ?? "";
  if (!n || n === "Grown-up") return null;
  if (named) return n;
  const local = email?.split("@")[0]?.slice(0, 60).toLowerCase();
  if (local && n.toLowerCase() === local) return null;
  if (n.includes("@")) return null;
  return n;
}
