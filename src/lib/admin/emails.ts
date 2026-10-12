/**
 * Who may use /admin. Pure, so the middleware (edge) and server pages share one list.
 * ADMIN_EMAILS is a comma-separated list; without it, the two Readli admin addresses below.
 */
export const DEFAULT_ADMIN_EMAILS = ["admin@readli.ai", "kevin@promptbox.com"];

export function adminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : DEFAULT_ADMIN_EMAILS;
}

/** A signed-in user is an admin only with a confirmed email on the list. */
export function isAdmin(user: { email?: string | null; email_confirmed_at?: string | null } | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email || !user?.email_confirmed_at) return false;
  return adminEmails(env).includes(email);
}

export const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");
