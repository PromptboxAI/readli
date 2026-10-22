import { membershipCertificate, membershipQrPng, membershipQrSvg } from "@/lib/admin/complimentary-artwork";
import { download, withArtworkAdmin } from "@/lib/admin/complimentary-http";
import { batchArtwork, logArtworkDownload } from "@/lib/admin/complimentary";
import { zip } from "@/lib/files/zip";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Every unrevoked membership in a batch: certificates.zip (PDFs) or qr-codes.zip (PNG and SVG). */
export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string; file: string }> }) {
  const { batchId, file } = await params;
  if (file !== "certificates.zip" && file !== "qr-codes.zip") return fail(404, "not_found", "Not found.");
  return withArtworkAdmin(async ({ db, admin, cipher, origin }) => {
    const all = await batchArtwork(db, cipher, batchId);
    if (!all.length) return fail(404, "no_artwork", "This batch has no memberships to download.");
    const entries =
      file === "certificates.zip"
        ? all.map((a) => ({ name: `readli-${a.certificate}-certificate.pdf`, data: membershipCertificate(a, origin) }))
        : all.flatMap((a) => [
            { name: `readli-${a.certificate}-qr-code.png`, data: membershipQrPng(a, origin) },
            { name: `readli-${a.certificate}-qr-code.svg`, data: Buffer.from(membershipQrSvg(a, origin), "utf8") },
          ]);
    await logArtworkDownload(db, admin, batchId, file === "certificates.zip" ? "all certificates (ZIP)" : "all QR codes (ZIP)");
    return download(zip(entries), `readli-${all[0]!.batch.prefix}-${file}`, "application/zip");
  });
}
