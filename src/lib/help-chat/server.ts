import { pricing } from "@/lib/content/pricing";
import { invitationSecret } from "@/lib/invitations/server";
import { publicLibrary } from "@/lib/library/public";
import { pricingKnowledge, staticKnowledge } from "./knowledge";

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
const PRICE_TTL_MS = 10 * 60_000;

/** The knowledge as two system blocks: the deploy-stable part, then today's prices. */
export async function helpChatKnowledge(now = Date.now()): Promise<{ stable: string; prices: string }> {
  staticText ??= staticKnowledge(publicLibrary());
  if (!priced || now - priced.at > PRICE_TTL_MS) {
    try {
      priced = { text: pricingKnowledge(await pricing()), at: now };
    } catch {
      priced ??= { text: "", at: now };
    }
  }
  return { stable: staticText, prices: priced.text };
}
