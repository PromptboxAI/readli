import { membershipCertificate, membershipQrPng, membershipQrSvg } from "@/lib/admin/complimentary-artwork";
import { download, withArtworkAdmin } from "@/lib/admin/complimentary-http";
import { logArtworkDownload, membershipArtwork } from "@/lib/admin/complimentary";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FILES = {
  "qr.png": { what: "the QR code (PNG)", type: "image/png" },
  "qr.svg": { what: "the QR code (SVG)", type: "image/svg+xml" },
  "certificate.pdf": { what: "the certificate", type: "application/pdf" },
} as const;

/** One membership's QR code or certificate, made from its stored code. Downloading again issues nothing new. */
export async function GET(_req: Request, { params }: { params: Promise<{ giftId: string; file: string }> }) {
  const { giftId, file } = await params;
  const spec = FILES[file as keyof typeof FILES];
  if (!spec) return fail(404, "not_found", "Not found.");
  return withArtworkAdmin(async ({ db, admin, cipher, origin }) => {
    const art = await membershipArtwork(db, cipher, giftId);
    if (!art) return fail(404, "no_artwork", "This membership has no stored code to make artwork from.");
    const body = file === "qr.png" ? membershipQrPng(art, origin) : file === "qr.svg" ? membershipQrSvg(art, origin) : membershipCertificate(art, origin);
    await logArtworkDownload(db, admin, art.batch.id, spec.what, art.certificate);
    return download(body, `readli-${art.certificate}-${file.replace("qr.", "qr-code.")}`, spec.type);
  });
}
