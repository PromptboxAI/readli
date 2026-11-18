import { findDemoBook } from "@/lib/content/demo-books";
import { guestForDemoToken } from "@/lib/email/guest-demo";
import { accountDb } from "@/lib/family/account-store";
import { guestDemoDeps } from "@/lib/server/guest-demo";
import { previewKey } from "@/lib/server/guest-preview";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** One story from an emailed demo, while its link still works. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; slug: string }> }) {
  const { token, slug } = await params;
  const deps = guestDemoDeps();
  const db = accountDb();
  const book = findDemoBook(slug);
  if (!deps || !db || !book) return fail(404, "not_found", "Not found.");
  const guestId = await guestForDemoToken(db, token);
  const voiceId = guestId ? await deps.store.getVoice(guestId) : null;
  const audio = guestId && voiceId ? await deps.store.findPreview(guestId, previewKey(voiceId, book.slug)).catch(() => null) : null;
  if (!audio) return fail(404, "not_found", "This demo has ended.");
  return new Response(audio.audio, { headers: { "content-type": audio.contentType, "cache-control": "private, no-store", "referrer-policy": "no-referrer" } });
}
