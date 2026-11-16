import { adminEmails } from "@/lib/admin/emails";
import { readliMailer } from "@/lib/email/send";
import { readliEmail } from "@/lib/email/templates";
import type { Mailer } from "@/lib/invitations/email";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Tells Readli's admins that the voice provider refused a customer's voice (usually ElevenLabs holding a
 * clone for a Terms of Service check). The customer is asked to record again in the app; this is so
 * someone at Readli knows it happened. Once a day per voice. Never throws.
 */
export async function alertVoiceRefused(
  input: { /** Which voice, for the admins: "Readli voice <id>" or "the new recording of user <id>". */ label: string; key: string; where: "narration" | "sample"; error: string },
  env: NodeJS.ProcessEnv = process.env,
  mailer: Mailer | null = readliMailer(env),
  now = new Date(),
): Promise<number> {
  if (!mailer) return 0;
  const day = now.toISOString().slice(0, 10);
  const message = readliEmail({
    subject: "Readli: the voice service refused a customer's voice",
    name: "",
    title: "A voice was refused",
    paragraphs: [
      `ElevenLabs refused ${input.label} while ${input.where === "narration" ? "preparing a story" : "making a sample"}. The customer is asked to record their voice again.`,
      "If it says the voice may violate the Terms of Service and needs verification, look for it in ElevenLabs under My Voices. Customers can't verify voices themselves.",
      `Error: ${input.error.slice(0, 300)}`,
    ],
    cta: { label: "See problems", url: `${SITE_URL}/admin/problems` },
    reason: "You're getting this because you're a Readli admin.",
  });
  let sent = 0;
  for (const to of adminEmails(env)) {
    try {
      await mailer.send({ to, ...message, headers: message.headers ?? {}, idempotencyKey: `voice-refused-${input.key}-${day}-${to}` });
      sent += 1;
    } catch (err) {
      console.error("voice refused alert failed", err);
    }
  }
  return sent;
}
