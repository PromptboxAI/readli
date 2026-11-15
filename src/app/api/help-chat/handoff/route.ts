import { NextResponse } from "next/server";
import { readliMailer } from "@/lib/email/send";
import { jsonBody } from "@/lib/family/http";
import { handoffEmail, parseHandoff } from "@/lib/help-chat/handoff";
import { verifyChatToken } from "@/lib/help-chat/limits";
import { helpChatSecret } from "@/lib/help-chat/server";
import { SUPPORT_EMAIL } from "@/lib/help/articles";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/** "Talk to a person": emails the chat to support, with Reply-To set to the person who asked. */
export async function POST(req: Request) {
  const secret = helpChatSecret();
  const mailer = readliMailer();
  if (!secret || !mailer) return fail(503, "off", `Please email us at ${SUPPORT_EMAIL}.`);

  const body = await jsonBody(req);
  if (verifyChatToken(secret, body.token) === "bad") return fail(401, "token", "Please close the chat and open it again.");
  if (!allow(`help-handoff:${clientAddress(req)}`, 3, 10 * 60_000))
    return fail(429, "slow_down", `We've got your message. If you need to add something, email ${SUPPORT_EMAIL}.`);

  const parsed = parseHandoff(body);
  if (!parsed.ok) return fail(400, "invalid", parsed.message);

  try {
    await mailer.send(handoffEmail(parsed.handoff, SUPPORT_EMAIL));
  } catch (err) {
    console.error("help-chat handoff", err);
    return fail(502, "send", `That didn't send. Please email us at ${SUPPORT_EMAIL}.`);
  }
  return NextResponse.json({ sent: true }, { headers: { "cache-control": "no-store" } });
}
