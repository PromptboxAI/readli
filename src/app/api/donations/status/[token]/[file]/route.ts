import { membershipCertificate, membershipQrPng } from "@/lib/admin/complimentary-artwork";
import { download } from "@/lib/admin/complimentary-http";
import { effectivePlan } from "@/lib/billing/price-settings";
import { money } from "@/lib/donations/program";
import { applicantArtwork, logApplicantDownload } from "@/lib/donations/server";
import { accountDb } from "@/lib/family/account-store";
import { giftCodeCipher } from "@/lib/gifting/code-cipher";
import { requestOrigin } from "@/lib/invitations/context";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FILES = {
  "certificate.pdf": { what: "the certificate (PDF)", type: "application/pdf" },
  "qr-code.png": { what: "the QR code (PNG)", type: "image/png" },
} as const;

/** The approved organization's certificate, from its private status link. Downloading again issues nothing new. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  if (!allow(`donation-file:${clientAddress(req)}`, 30, 60_000)) return fail(429, "slow_down", "Please wait a minute and try again.");
  const { token, file } = await params;
  const spec = FILES[file as keyof typeof FILES];
  const db = accountDb();
  const cipher = giftCodeCipher();
  if (!spec || !db || !cipher) return fail(404, "not_found", "Not found.");
  const found = await applicantArtwork(db, cipher, token);
  if (!found) return fail(404, "not_found", "This certificate isn't available.");
  const origin = await requestOrigin();
  const body =
    file === "qr-code.png"
      ? membershipQrPng(found.art, origin)
      : membershipCertificate(found.art, origin, { retailValue: money((await effectivePlan(db)).familyAnnualPriceCents) });
  await logApplicantDownload(db, found.requestId, spec.what);
  return download(body, `readli-gives-back-${found.art.certificate}-${file}`, spec.type);
}
