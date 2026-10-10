import { findDemoBook } from "@/lib/content/demo-books";
import { sentencesOf } from "@/lib/content/sentences";
import { withFamily } from "@/lib/family/http";
import { authorizeAssetPlayback } from "@/lib/family/service";
import { familyProvider } from "@/lib/family/session";

export const dynamic = "force-dynamic";

/**
 * Streams generated narration after re-checking both keys, so audio made before a revocation stops
 * working for the child straight away. The preview family has no real voices, so this is stand-in audio.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  return withFamily(async ({ store, actor }) => {
    const asset = await authorizeAssetPlayback(store, actor, assetId);
    const text = sentencesOf(findDemoBook(asset.bookSlug)?.passageText ?? "")[asset.sentence] ?? "";
    const { audio, contentType, standIn } = await familyProvider().synthesize({ voiceId: asset.voiceId, text });
    return new Response(audio, {
      headers: { "content-type": contentType, "cache-control": "private, no-store", "x-readli-stand-in": standIn ? "1" : "0" },
    });
  });
}
