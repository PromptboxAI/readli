import { currentGuest, guestDemoDeps } from "@/lib/server/guest-demo";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { findGuestTake } from "@/lib/voice/guest-handoff";

/**
 * What the voice recorder needs to open in place, for a signed-in grown-up: whether they already have a voice,
 * a recording made earlier but never kept, and the /try take this browser still holds. Null when voices are off.
 */
export async function recorderProps(userId: string) {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return null;
  const existing = await deps.store.findVoice(userId).catch(() => null);
  const candidate = await deps.store.findCandidate(userId).catch(() => null);
  const guestDeps = guestDemoDeps();
  const guestTake = guestDeps ? await currentGuest(guestDeps).then((g) => findGuestTake(guestDeps.store, g)).catch(() => null) : null;
  return {
    hasVoice: Boolean(existing),
    guestTake,
    waiting: candidate ? { createdAt: candidate.createdAt, cleanUp: candidate.removeBackgroundNoise } : null,
  };
}
