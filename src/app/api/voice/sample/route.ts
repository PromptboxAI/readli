import { currentAdult } from "@/lib/auth/adult";
import { serverConfig } from "@/lib/server/config";
import { findDemoBook } from "@/lib/content/demo-books";
import { fail } from "@/lib/server/http";
import { AccountVoiceError, accountVoiceDeps, accountVoiceSample } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * A short line in the signed-in grown-up's own voice, so they can check it before sharing it.
 * `?candidate=1` plays the new recording they haven't kept yet; `?latest=1` plays their voice on the
 * newest reading model, so they can decide whether to switch. `?book=<slug>` reads a demo book's opening instead. Samples are on Readli.
 */
export async function POST(req: Request) {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in to hear your voice.");
  try {
    const params = new URL(req.url).searchParams;
    // `?book=<slug>` reads the opening of one of the demo books, as the /try bookshelf does for guests.
    const slug = params.get("book");
    const book = slug ? findDemoBook(slug) : undefined;
    if (slug && !book?.passageText) return fail(404, "no_book", "That story isn't available to hear yet.");
    const text = book?.passageText ?? undefined;
    const sample = await accountVoiceSample(deps, user.id, { candidate: params.get("candidate") === "1", latest: params.get("latest") === "1", text });
    return new Response(sample.audio, {
      headers: { "content-type": sample.contentType, "cache-control": "no-store", "x-readli-stand-in": sample.standIn ? "1" : "0" },
    });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}
