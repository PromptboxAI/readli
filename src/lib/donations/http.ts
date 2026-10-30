import { accountDb } from "@/lib/family/account-store";
import { emailSecret } from "@/lib/email/send";
import { SUPPORT_EMAIL } from "./emails";
import { requestOrigin } from "@/lib/invitations/context";
import { fail } from "@/lib/server/http";
import { DonationError, type DonationContext, type Upload } from "./server";

/** The server pieces a public donation route needs, or a 503 when this deployment isn't connected. */
export async function withDonations(run: (ctx: DonationContext) => Promise<Response>): Promise<Response> {
  const db = accountDb();
  const secret = emailSecret();
  if (!db || !secret) return fail(503, "not_configured", `Donation requests aren't switched on here yet. Please email ${SUPPORT_EMAIL}.`);
  try {
    return await run({ db, secret, base: await requestOrigin() });
  } catch (err) {
    if (err instanceof DonationError) return fail(err.status, err.code, err.message);
    throw err;
  }
}

/** An optional uploaded file from a multipart form. */
export async function formFile(form: FormData, name: string): Promise<Upload | null> {
  const f = form.get(name);
  if (!f || typeof f === "string" || f.size === 0) return null;
  return { bytes: new Uint8Array(await f.arrayBuffer()), type: f.type };
}

export const text = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};
