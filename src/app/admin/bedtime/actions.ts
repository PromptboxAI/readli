"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { BedtimeError, chooseFeaturedBooks } from "@/lib/email/bedtime";
import { accountDb } from "@/lib/family/account-store";

export async function chooseBooksAction(form: FormData) {
  const gate = await requireAdmin("/admin/bedtime");
  const db = accountDb();
  if (gate.preview || !db) redirect(`/admin/bedtime?err=${encodeURIComponent("Picking stories needs Supabase connected.")}`);
  const weekOf = String(form.get("weekOf") ?? "");
  let outcome: string;
  try {
    const books = await chooseFeaturedBooks(db, gate.admin.id, weekOf, [String(form.get("first") ?? ""), String(form.get("second") ?? "")]);
    outcome = `ok=${encodeURIComponent(`Saved: ${books.map((b) => b.title).join(" and ")}.`)}`;
  } catch (err) {
    if (!(err instanceof BedtimeError)) throw err;
    outcome = `err=${encodeURIComponent(err.message)}`;
  }
  redirect(`/admin/bedtime?${outcome}`);
}
