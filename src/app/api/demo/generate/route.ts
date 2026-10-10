import { findDemoBook } from "@/lib/content/demo-books";
import { currentGuest, effectiveMode, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail, NO_SESSION, PREVIEWS_OFF } from "@/lib/server/http";
import { VoiceProviderError } from "@/lib/voice/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reads one demo passage in the guest's cloned voice. Spends a preview; refunds it if synthesis fails. */
export async function POST(req: Request) {
  const deps = guestDemoDeps();
  if ((await effectiveMode(deps)) === "off" || !deps) return fail(503, "previews_off", PREVIEWS_OFF);
  const guest = await currentGuest(deps);
  if (!guest) return fail(401, "no_session", NO_SESSION);

  const { slug } = (await req.json().catch(() => ({}))) as { slug?: unknown };
  const book = typeof slug === "string" ? findDemoBook(slug) : undefined;
  if (!book?.passageText) return fail(404, "unknown_book", "That story isn't available for previews.");

  const voiceId = await deps.store.getVoice(guest.id);
  if (!voiceId) return fail(409, "no_voice", "Your voice isn't ready yet. Record your voice first.");

  if (!(await deps.store.useGeneration(guest.id))) {
    return fail(429, "no_previews_left", "You've used your free previews. Create a free account to hear more stories in your voice.");
  }

  try {
    const { audio, contentType, standIn } = await deps.provider.synthesize({ voiceId, text: book.passageText });
    return new Response(audio, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, no-store",
        "x-readli-stand-in": standIn ? "1" : "0",
        "x-readli-previews-left": String(Math.max(0, guest.generationsAllowed - guest.generationsUsed - 1)),
      },
    });
  } catch (err) {
    await deps.store.refundGeneration(guest.id).catch(() => undefined);
    console.error("preview synthesis failed", err);
    const message = err instanceof VoiceProviderError ? err.userMessage : "We couldn't read that story just now. Please try again.";
    return fail(502, "synthesis_failed", message);
  }
}
