import { pricing } from "@/lib/content/pricing";
import { invitationSecret } from "@/lib/invitations/server";
import { publicLibrary } from "@/lib/library/public";
import { SITE_URL } from "@/lib/seo/site";
import { pricingKnowledge, staticKnowledge } from "./knowledge";
import { readSitePages } from "./site-pages";

/** The model behind the help chatbot (Kevin, 2026-11-15: start on Opus, revisit if the bill grows). */
export const HELP_CHAT_MODEL = "claude-opus-5-5";

/** On when an Anthropic key is set, unless HELP_CHAT_ENABLED=false switches it off everywhere. */
export function helpChatEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.HELP_CHAT_ENABLED === "false") return false;
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Signs widget tokens; the same secret family as invitations and guest cookies. */
export const helpChatSecret = (env: NodeJS.ProcessEnv = process.env) => invitationSecret(env) ?? env.ANTHROPIC_API_KEY ?? null;

let staticText: string | null = null;
let priced: { text: string; at: number } | null = null;
let site: { text: string; at: number; complete: boolean } | null = null;
let reading: Promise<void> | null = null;
const PRICE_TTL_MS = 10 * 60_000;
const SITE_TTL_MS = 6 * 60 * 60_000;
const SITE_RETRY_MS = 5 * 60_000;

/**
 * Where to read the public pages from: readli.ai in production, this deployment's own URL on
 * previews (with Vercel's automation bypass when protection is on), and the request's origin locally.
 */
export function siteOrigin(requestUrl: string, env: NodeJS.ProcessEnv = process.env): { origin: string; headers: Record<string, string> } {
  const headers: Record<string, string> = env.VERCEL_AUTOMATION_BYPASS_SECRET ? { "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
  if (env.VERCEL_ENV === "production") return { origin: SITE_URL, headers };
  if (env.VERCEL_URL) return { origin: `https://${env.VERCEL_URL}`, headers };
  return { origin: new URL(requestUrl).origin, headers };
}

async function refreshSite(requestUrl: string, now: number) {
  const { origin, headers } = siteOrigin(requestUrl);
  const r = await readSitePages(origin, undefined, { headers });
  // Keep a fuller earlier read over a worse new one (a slow moment shouldn't shrink what the bot knows).
  if (r.text && (!site || r.read * 2 >= r.total || !site.complete)) site = { text: r.text, at: now, complete: r.read * 2 >= r.total };
  else if (site) site = { ...site, at: now - SITE_TTL_MS + SITE_RETRY_MS };
  else site = { text: "", at: now - SITE_TTL_MS + SITE_RETRY_MS, complete: false };
}

/** The knowledge as system blocks: what's in the code, the public pages as rendered, then today's prices. */
export async function helpChatKnowledge(requestUrl: string, now = Date.now()): Promise<{ stable: string; pages: string; prices: string }> {
  staticText ??= staticKnowledge(publicLibrary());
  if (!priced || now - priced.at > PRICE_TTL_MS) {
    try {
      priced = { text: pricingKnowledge(await pricing()), at: now };
    } catch {
      priced ??= { text: "", at: now };
    }
  }
  if (!site || now - site.at > SITE_TTL_MS) {
    reading ??= refreshSite(requestUrl, now)
      .catch(() => undefined)
      .finally(() => (reading = null));
    // The first question on a new server waits for the pages; later refreshes happen behind the scenes.
    if (!site) await reading;
  }
  return { stable: staticText, pages: site?.text ?? "", prices: priced.text };
}
