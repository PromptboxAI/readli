import { createHash } from "node:crypto";
import { findDemoBook } from "@/lib/content/demo-books";
import { modelCost } from "@/lib/narration/costs";
import { currentGuest, effectiveMode, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail, NO_SESSION, PREVIEWS_OFF } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { VoiceProviderError } from "@/lib/voice/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Names one voice + book pair without exposing the provider voice id. */
function previewKey(providerVoiceId: string, slug: string): string {
  return `${createHash("sha256").update(providerVoiceId).digest("hex").slice(0, 16)}-${slug}`;
}

/**
 * Reads one demo passage in the guest's cloned voice. A story already read in this voice replays
 * from storage for free; a new one spends a preview, which is refunded if synthesis fails.
 */
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

  const key = previewKey(voiceId, book.slug);
  const counts = (used: number) => ({
    "x-readli-previews-left": String(Math.max(0, guest.generationsAllowed - used)),
    "x-readli-previews-allowed": String(guest.generationsAllowed),
  });

  const cached = await deps.store.findPreview(guest.id, key).catch((err) => {
    console.error("cached preview lookup failed", err);
    return null;
  });
  if (cached) {
    await recordVoiceEvent(deps.config, { name: "preview_replayed", guestSessionId: guest.id, properties: { slug: book.slug } });
    return new Response(cached.audio, {
      headers: {
        "content-type": cached.contentType,
        "cache-control": "private, no-store",
        "x-readli-stand-in": deps.config.mode === "stub" ? "1" : "0",
        "x-readli-cached": "1",
        ...counts(guest.generationsUsed),
      },
    });
  }

  if (!(await deps.store.useGeneration(guest.id))) {
    return fail(429, "no_previews_left", "You've explored all your free stories. Create a free account to hear more in your voice.");
  }

  try {
    const { audio, contentType, standIn, modelId, characters } = await deps.provider.synthesize({ voiceId, text: book.passageText });
    await deps.store.savePreview(guest.id, key, audio, contentType).catch((err) => console.error("preview cache save failed", err));
    const model = modelId ?? deps.config.elevenLabsModel;
    const billed = characters ?? book.passageText.length;
    await recordVoiceEvent(deps.config, {
      name: "preview_generated",
      guestSessionId: guest.id,
      properties: {
        slug: book.slug,
        model,
        characters: billed,
        // Planning rate per 1,000 characters for this model; finance compares it with invoices.
        usd: Number(((billed / 1000) * modelCost(model).usdPer1kCharacters).toFixed(6)),
      },
    });
    return new Response(audio, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, no-store",
        "x-readli-stand-in": standIn ? "1" : "0",
        "x-readli-cached": "0",
        ...counts(guest.generationsUsed + 1),
      },
    });
  } catch (err) {
    await deps.store.refundGeneration(guest.id).catch(() => undefined);
    console.error("preview synthesis failed", err);
    const message = err instanceof VoiceProviderError ? err.userMessage : "We couldn't read that story just now. Please try again.";
    return fail(502, "synthesis_failed", message);
  }
}
