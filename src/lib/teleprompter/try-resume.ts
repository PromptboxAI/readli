/**
 * Remembers, in this tab, that the guest made a voice on /try and heard a story in it. Coming back to
 * /try with the browser's Back button (from signup or checkout) reopens the stories in that voice
 * instead of starting over at the consent boxes. The server still decides whether the voice exists.
 */
const KEY = "readli.tryVoice";
/** Guest sessions end within 21 hours; past that there's nothing to come back to. */
const MAX_AGE_MS = 21 * 3_600_000;

export function rememberTryVoice(cleanUp: boolean, book: string | null = null, now = Date.now()): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ cleanUp, book, at: now }));
  } catch {
    // Storage blocked: Back starts the demo over, as before.
  }
}

/** The clean-up setting of the voice this tab made, or null when there's none to come back to. */
export function rememberedTryVoice(now = Date.now()): boolean | null {
  return rememberedTry(now)?.cleanUp ?? null;
}

/** The last story heard in that voice, to put back in the player. */
export function rememberedTryBook(now = Date.now()): string | null {
  return rememberedTry(now)?.book ?? null;
}

function rememberedTry(now: number): { cleanUp: boolean; book: string | null } | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { cleanUp?: unknown; book?: unknown; at?: unknown };
    if (typeof v.cleanUp !== "boolean" || typeof v.at !== "number" || now - v.at > MAX_AGE_MS || v.at > now) return null;
    return { cleanUp: v.cleanUp, book: typeof v.book === "string" ? v.book : null };
  } catch {
    return null;
  }
}

export function forgetTryVoice(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
