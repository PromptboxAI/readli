"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { accountDb } from "@/lib/family/account-store";
import { settingsUpdate } from "@/lib/invitations/server";

const back = (outcome: string) => redirect(`/admin/invitations?${outcome}`);

export async function saveInvitationSettingsAction(form: FormData) {
  const gate = await requireAdmin("/admin/invitations");
  const db = accountDb();
  if (gate.preview || !db) return back(`err=${encodeURIComponent("Invitation settings need Supabase connected.")}`);
  const update = settingsUpdate(Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])));
  if (!update.ok) return back(`err=${encodeURIComponent(update.message)}`);
  const { error } = await db.from("voice_invitation_settings").upsert({ id: true, ...update.row, updated_at: new Date().toISOString(), updated_by: gate.admin.id }, { onConflict: "id" });
  back(error ? `err=${encodeURIComponent(`Couldn't save: ${error.message}`)}` : `ok=${encodeURIComponent("Saved the invitation settings.")}`);
}

export async function reviewReportAction(form: FormData) {
  const gate = await requireAdmin("/admin/invitations");
  const db = accountDb();
  const id = form.get("id");
  if (gate.preview || !db || typeof id !== "string") return back(`err=${encodeURIComponent("Reports need Supabase connected.")}`);
  const { error } = await db.from("voice_invitation_reports").update({ reviewed_at: new Date().toISOString(), reviewed_by: gate.admin.id }).eq("id", id);
  back(error ? `err=${encodeURIComponent(`Couldn't save: ${error.message}`)}` : `ok=${encodeURIComponent("Marked the report reviewed.")}`);
}
