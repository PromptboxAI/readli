import { NextResponse } from "next/server";
import { FeedbackError, fromFeedbackToken, saveFeedback } from "@/lib/email/feedback";
import { emailSecret } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody } from "@/lib/family/http";
import { fail } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/** Saves an answer from /feedback. The signed link says who is answering and which question. */
export async function POST(req: Request) {
  const secret = emailSecret();
  const db = accountDb();
  if (!secret || !db) return fail(503, "off", "Feedback isn't available right now.");
  const body = await jsonBody(req);
  const who = fromFeedbackToken(secret, body.t);
  if (!who) return fail(400, "bad_link", "This feedback link doesn't work.");
  if (!allow(`feedback:${who.userId}`, 5, 60_000)) return fail(429, "slow_down", "Please wait a minute and try again.");
  try {
    await saveFeedback(db, who, body);
  } catch (err) {
    if (err instanceof FeedbackError) return fail(400, "incomplete", err.message);
    throw err;
  }
  return NextResponse.json({ saved: true });
}
