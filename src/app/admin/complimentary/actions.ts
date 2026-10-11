"use server";

import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin/access";
import { giftLink, issueComplimentary } from "@/lib/admin/complimentary";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { accountDb } from "@/lib/family/account-store";

export type IssueResult = { links: string[]; organization: string } | { error: string } | null;

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

export async function issueComplimentaryAction(_prev: IssueResult, form: FormData): Promise<IssueResult> {
  const gate = await requireAdmin("/admin/complimentary");
  const db = accountDb();
  if (gate.preview || !db) return { error: "Complimentary memberships need sign-in and Supabase connected." };
  try {
    const organization = field(form, "organization").trim();
    const codes = await issueComplimentary(db, gate.admin, {
      organization,
      kind: field(form, "kind"),
      count: Number(field(form, "count")),
      message: field(form, "message"),
    });
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "readli.ai"}`;
    return { organization, links: codes.map((c) => giftLink(origin, c)) };
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    throw err;
  }
}
