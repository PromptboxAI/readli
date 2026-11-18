"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { accountDb } from "@/lib/family/account-store";
import { SITE_BANNER_TAG, parseBannerForm } from "@/lib/marketing/site-banner";

export async function saveBannerAction(form: FormData) {
  const gate = await requireAdmin("/admin/banner");
  const db = accountDb();
  const parsed = parseBannerForm(form);
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("The banner needs Supabase connected.")}`;
  else if (!parsed.ok) outcome = `err=${encodeURIComponent(parsed.error)}`;
  else {
    const row = { ...parsed.row, updated_at: new Date().toISOString(), updated_by: gate.admin.id };
    let { error } = await db.from("site_banner").upsert(row, { onConflict: "id" });
    let styleSaved = true;
    if (error && /style/.test(error.message)) {
      const withoutStyle: Record<string, unknown> = { ...row };
      delete withoutStyle.style;
      ({ error } = await db.from("site_banner").upsert(withoutStyle, { onConflict: "id" }));
      styleSaved = false;
    }
    if (!error) revalidateTag(SITE_BANNER_TAG);
    outcome = error
      ? `err=${encodeURIComponent(`Couldn't save: ${error.message}`)}`
      : styleSaved
        ? `ok=${encodeURIComponent("Saved. The site shows the change now.")}`
        : `err=${encodeURIComponent("Saved everything except the look: the database needs the banner-style update first, so the site shows the Festive look for now.")}`;
  }
  redirect(`/admin/banner?${outcome}`);
}
