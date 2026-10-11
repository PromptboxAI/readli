import { notFound, redirect } from "next/navigation";
import { authConfigured, displayName, supabaseServer } from "@/lib/auth/supabase";
import { familyPreviewEnabled } from "@/lib/family/session";
import { isAdmin } from "./emails";

/**
 * Local dev and tests have no sign-in, so /admin stays open there to keep the pages previewable.
 * Anywhere sign-in is configured (production), only named admins get in.
 */
export function adminPreviewOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  return !authConfigured(env) && familyPreviewEnabled(env);
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

/** The signed-in admin, or null for anyone else (including the open preview). */
export async function currentAdmin(): Promise<AdminUser | null> {
  if (!authConfigured()) return null;
  const { data, error } = await (await supabaseServer()).auth.getUser();
  if (error || !isAdmin(data.user)) return null;
  return { id: data.user!.id, email: data.user!.email!, name: displayName(data.user!) };
}

/**
 * Gate for every admin page. The middleware already turns non-admins away; this repeats the check
 * so a page is never served on the strength of a layout or a client-side navigation alone.
 */
export async function requireAdmin(path: string): Promise<{ preview: true } | { preview: false; admin: AdminUser }> {
  if (adminPreviewOpen()) return { preview: true };
  if (!authConfigured()) notFound();
  const admin = await currentAdmin();
  if (admin) return { preview: false, admin };
  const { data } = await (await supabaseServer()).auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(path)}`);
  notFound();
}
