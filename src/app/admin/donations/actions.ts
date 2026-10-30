"use server";

import { redirect } from "next/navigation";
import { requireAdmin, type AdminUser } from "@/lib/admin/access";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { effectivePlan } from "@/lib/billing/price-settings";
import { money } from "@/lib/donations/program";
import { approveRequest, askForInfo, rejectRequest, resendCertificate, type DonationContext } from "@/lib/donations/server";
import { emailSecret } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { giftCodeCipher } from "@/lib/gifting/code-cipher";
import { requestOrigin } from "@/lib/invitations/context";

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

/** Runs a review decision after re-checking who is asking, then returns to the request with the outcome. */
async function asAdmin(form: FormData, run: (ctx: DonationContext, admin: AdminUser, id: string) => Promise<string>) {
  const id = field(form, "id");
  const path = `/admin/donations/${encodeURIComponent(id)}`;
  const gate = await requireAdmin(path);
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
  redirect(`${path}?${outcome}`);
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
    return "Declined. The applicant has been emailed your reason.";
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
