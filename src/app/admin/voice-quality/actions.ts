"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { serverConfig } from "@/lib/server/config";
import { saveGuestPreviewsAllowed } from "@/lib/server/demo-settings";

/** Saves how many stories a demo guest can hear in their voice. Applies to new demo sessions. */
export async function updateDemoPreviewsAction(form: FormData) {
  const gate = await requireAdmin("/admin/voice-quality");
  let outcome: string;
  try {
    const n = await saveGuestPreviewsAllowed(serverConfig(), Number(form.get("previews")), gate.preview ? "" : gate.admin.id);
    outcome = `ok=${encodeURIComponent(`New demo sessions can hear ${n} ${n === 1 ? "story" : "stories"}.`)}`;
  } catch (err) {
    outcome = `err=${encodeURIComponent(err instanceof Error ? err.message : "Couldn't save that.")}`;
  }
  redirect(`/admin/voice-quality?${outcome}`);
}
