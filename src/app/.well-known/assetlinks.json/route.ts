import { assetLinks } from "@/lib/android/asset-links";

export const dynamic = "force-dynamic";

/** Android checks this file to trust the Readli app; the signing keys come from a Vercel env var. */
export function GET() {
  return Response.json(assetLinks(process.env.ANDROID_CERT_FINGERPRINTS), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
