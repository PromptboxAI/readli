"use server";

import { redirect } from "next/navigation";
import { requireAdmin, type AdminUser } from "@/lib/admin/access";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { effectivePlan } from "@/lib/billing/price-settings";
import { money } from "@/lib/donations/program";
import { approveRequest, askForInfo, deleteRequest, rejectRequest, resendCertificate, type DonationContext } from "@/lib/donations/server";
import { emailSecret } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { giftCodeCipher } from "@/lib/gifting/code-cipher";
import { requestOrigin } from "@/lib/invitations/context";

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

/** Where to land afterwards: the request itself, or the list (keeping its filter and search) when the action came from a row menu. */
function landing(form: FormData, id: string): { path: string; gatePath: string } {
  const detail = `/admin/donations/${encodeURIComponent(id)}`;
  if (field(form, "from") !== "list") return { path: `${detail}?`, gatePath: detail };
  const list = new URLSearchParams();
  const show = field(form, "show");
  const q = field(form, "q");
  if (/^[a-z]{1,20}$/.test(show)) list.set("show", show);
  if (q) list.set("q", q.slice(0, 200));
  const qs = list.toString();
  return { path: `/admin/donations?${qs ? `${qs}&` : ""}`, gatePath: "/admin/donations" };
}

/** Runs a review decision after re-checking who is asking, then returns to the request (or the list) with the outcome. */
async function asAdmin(form: FormData, run: (ctx: DonationContext, admin: AdminUser, id: string) => Promise<string>) {
  const id = field(form, "id");
  const { path, gatePath } = landing(form, id);
  const gate = await requireAdmin(gatePath);
  const db = accountDb();
  const secret = emailSecret();
  let outcome: string;
  if (gate.preview || !db || !secret) outcome = `err=${encodeURIComponent("Readli Gives Back needs sign-in, Supabase and email connected.")}`;
  else {
    try {
      outcome = `ok=${encodeURIComponent(await run({ db, secret, base: await requestOrigin() }, gate.admin, id))}`;
    } catch (err) {
      if (!(err instanceof AdminActionError)) throw err;
      outcome = `err=${encodeURIComponent(err.message)}`;
    }
  }
  redirect(`${path}${outcome}`);
}

const retailValue = async (ctx: DonationContext) => money((await effectivePlan(ctx.db)).familyAnnualPriceCents);

export async function approveAction(form: FormData) {
  await asAdmin(form, async (ctx, admin, id) => {
    const cipher = giftCodeCipher();
    if (!cipher) throw new AdminActionError("Certificates need PROVIDER_REF_SECRET set.");
    await approveRequest(ctx, admin, id, { cipher, retailValue: await retailValue(ctx) });
    return "Approved. The certificate is issued and on its way to the applicant.";
  });
}

export async function rejectAction(form: FormData) {
  await asAdmin(form, async (ctx, admin, id) => {
    await rejectRequest(ctx, admin, id, field(form, "reason"));
    const ref = field(form, "reference");
    const r = field(form, "from") === "list" && /^RGB-[0-9A-Z]{6}$/.test(ref) ? ` ${ref}` : "";
    return `Declined${r}. The applicant has been emailed your reason.`;
  });
}

/** Deletes a spam or junk request: no email, and the deletion is kept in the admin activity log. Always lands on the list. */
export async function deleteAction(form: FormData) {
  form.set("from", "list");
  await asAdmin(form, async (ctx, admin, id) => {
    const { reference } = await deleteRequest(ctx.db, admin, id);
    return `Deleted ${reference}. No email was sent; the deletion is in the admin activity log.`;
  });
}

export async function askForInfoAction(form: FormData) {
  await asAdmin(form, async (ctx, admin, id) => {
    await askForInfo(ctx, admin, id, field(form, "message"));
    return "Sent. The request waits for the applicant's reply.";
  });
}

export async function resendAction(form: FormData) {
  await asAdmin(form, async (ctx, admin, id) => {
    await resendCertificate(ctx, admin, id, await retailValue(ctx));
    return "Sent the certificate email again.";
  });
}
