import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody } from "@/lib/family/http";
import { dailyCapUsd, parseChat, recordSpend, replyUsd, signChatToken, spentToday, verifyChatToken } from "@/lib/help-chat/limits";
import { HELP_CHAT_RULES } from "@/lib/help-chat/prompt";
import { HELP_CHAT_MODEL, helpChatEnabled, helpChatKnowledge, helpChatSecret } from "@/lib/help-chat/server";
import { SUPPORT_EMAIL } from "@/lib/help/articles";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OFF = `The help assistant is resting right now. Please use Talk to a person or email ${SUPPORT_EMAIL}.`;
const TROUBLE = `Sorry, I couldn't finish that answer. Please try again, or use Talk to a person to reach our team.`;

/** Same-site requests only: the widget runs on readli.ai, so a different Origin is someone else's page. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

/** The widget fetches a token when it opens; questions must carry it. */
export async function GET() {
  const secret = helpChatSecret();
  if (!helpChatEnabled() || !secret) return fail(503, "off", OFF);
  return NextResponse.json({ token: signChatToken(secret) }, { headers: { "cache-control": "no-store" } });
}

/** Answers a question from Readli's own help content, streamed back as plain text. */
export async function POST(req: Request) {
  const secret = helpChatSecret();
  if (!helpChatEnabled() || !secret) return fail(503, "off", OFF);
  if (!sameOrigin(req)) return fail(403, "origin", "This chat only works on readli.ai.");

  const body = await jsonBody(req);
  const token = verifyChatToken(secret, body.token);
  if (token === "bad") return fail(401, "token", "Please close the chat and open it again.");
  if (token === "too_soon") return fail(429, "slow_down", "One moment, then try again.");

  const ip = clientAddress(req);
  if (!allow(`help-chat:${ip}`, 8, 60_000)) return fail(429, "slow_down", "That's a lot of questions at once. Please wait a minute.");
  if (!allow(`help-chat-day:${ip}`, 100, 24 * 60 * 60_000)) return fail(429, "daily", `You've reached today's chat limit. Please email ${SUPPORT_EMAIL}.`);

  const chat = parseChat(body.messages);
  if (!chat.ok) return fail(400, "invalid", chat.message);

  const db = accountDb();
  if ((await spentToday(db).catch(() => 0)) >= dailyCapUsd()) return fail(503, "cap", OFF);

  const { stable, pages, prices } = await helpChatKnowledge(req.url);
  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      const write = (text: string) => {
        wrote ||= text.trim().length > 0;
        controller.enqueue(encoder.encode(text));
      };
      try {
        const run = client.beta.messages.stream({
          model: HELP_CHAT_MODEL,
          max_tokens: 4000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" },
          system: [
            { type: "text", text: HELP_CHAT_RULES },
            { type: "text", text: `<readli_knowledge>\n${stable}\n</readli_knowledge>`, ...(pages ? {} : { cache_control: { type: "ephemeral" as const } }) },
            ...(pages ? [{ type: "text" as const, text: `<readli_site_pages>\n${pages}\n</readli_site_pages>`, cache_control: { type: "ephemeral" as const } }] : []),
            ...(prices ? [{ type: "text" as const, text: prices }] : []),
          ],
          messages: chat.messages,
        });
        run.on("text", (delta) => write(delta));
        const final = await run.finalMessage();
        if (final.stop_reason === "refusal" || !wrote) write(wrote ? `\n\n${TROUBLE}` : TROUBLE);
        await recordSpend(db, replyUsd(final.usage)).catch(() => undefined);
      } catch (err) {
        console.error("help-chat", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        write(wrote ? `\n\n${TROUBLE}` : TROUBLE);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
