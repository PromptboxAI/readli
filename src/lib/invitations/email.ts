/**
 * Invitation email through Resend, Readli's transactional email provider. Server-only: it reads
 * RESEND_API_KEY. No tracking pixels and no click tracking: "opened" is the preview page being
 * visited. Every email carries one-click unsubscribe (RFC 8058).
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export interface Mailer {
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

export class MailerError extends Error {}

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(email: OutgoingEmail) {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, html: email.html, text: email.text, headers: email.headers }),
    });
    if (!res.ok) throw new MailerError(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { id?: string };
    return { id: body.id ?? "" };
  }
}

/** Keeps sent email in memory: stub mode and tests. */
export class MemoryMailer implements Mailer {
  readonly sent: (OutgoingEmail & { id: string })[] = [];
  async send(email: OutgoingEmail) {
    const id = `mem_${this.sent.length + 1}`;
    this.sent.push({ ...email, id });
    return { id };
  }
}

const g = globalThis as typeof globalThis & { __readliMailer?: MemoryMailer };

/** The configured mailer, or null when invitation email isn't set up here. */
export function invitationMailer(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  // One Resend key for all of Readli's email; invitations can use their own sender, else the shared one.
  const from = env.INVITE_EMAIL_FROM || env.EMAIL_FROM;
  if (env.RESEND_API_KEY && from) return new ResendMailer(env.RESEND_API_KEY, from);
  if (env.VOICE_PROVIDER === "stub") return (g.__readliMailer ??= new MemoryMailer());
  return null;
}

export interface InvitationEmailInput {
  contributorName: string;
  recipientName: string;
  message: string;
  bookTitle: string;
  previewUrl: string;
  declineUrl: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
  reportUrl: string;
  linkDays: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function invitationEmail(input: InvitationEmailInput): Omit<OutgoingEmail, "to"> {
  const who = input.contributorName;
  const hello = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const subject = `${who} recorded a story for your family on Readli`;
  const lines = [
    hello,
    "",
    `${who} made a Readli voice and recorded a short preview from ${input.bookTitle} for you to hear.`,
    ...(input.message ? ["", `${who} wrote:`, input.message] : []),
    "",
    `Hear ${who}'s voice: ${input.previewUrl}`,
    "",
    `Readli turns classic children's books into read-alongs in the voices of the people your kids love. You can listen without an account. The link works for ${input.linkDays} days.`,
    "",
    `Not for you? Decline: ${input.declineUrl}`,
    `Stop all Readli invitations: ${input.unsubscribeUrl}`,
    `Report this email: ${input.reportUrl}`,
    "",
    `You're getting this because ${who} entered your email address on Readli. We don't add you to any mailing list.`,
  ];
  const message = input.message
    ? `<p style="margin:16px 0 4px;font-weight:600">${esc(who)} wrote:</p><p style="margin:0;padding:12px 16px;background:#fff7e0;border-radius:12px;white-space:pre-line">${esc(input.message)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2a2340">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:700;margin:0 0 16px">Readli</p>
<div style="background:#ffffff;border-radius:20px;padding:24px">
<p style="margin:0 0 12px">${esc(hello)}</p>
<p style="margin:0">${esc(who)} made a Readli voice and recorded a short preview from <strong>${esc(input.bookTitle)}</strong> for you to hear.</p>
${message}
<p style="margin:24px 0;text-align:center"><a href="${esc(input.previewUrl)}" style="display:inline-block;background:#ff7a59;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">Hear ${esc(who)}'s voice</a></p>
<p style="margin:0;font-size:14px">Readli turns classic children's books into read-alongs in the voices of the people your kids love. You can listen without an account. The link works for ${input.linkDays} days.</p>
</div>
<p style="font-size:12px;color:#6b6480;margin:16px 0 0">Not for you? <a href="${esc(input.declineUrl)}" style="color:#6b6480">Decline</a> · <a href="${esc(input.unsubscribeUrl)}" style="color:#6b6480">Stop all Readli invitations</a> · <a href="${esc(input.reportUrl)}" style="color:#6b6480">Report this email</a></p>
<p style="font-size:12px;color:#6b6480;margin:8px 0 0">You're getting this because ${esc(who)} entered your email address on Readli. We don't add you to any mailing list.</p>
</div></body></html>`;
  return {
    subject,
    html,
    text: lines.join("\n"),
    headers: { "List-Unsubscribe": `<${input.oneClickUnsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export interface GiftEmailInput {
  giverName: string;
  recipientName: string;
  message: string;
  planName: string;
  code: string;
  openUrl: string;
  oneClickUnsubscribeUrl: string;
}

/** A paid Readli Family gift, with its code. Same look and one-click unsubscribe as invitations. */
export function giftEmail(input: GiftEmailInput): Omit<OutgoingEmail, "to"> {
  const who = input.giverName;
  const hello = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const subject = `${who} gave your family Readli`;
  const lines = [
    hello,
    "",
    `${who} gave your family ${input.planName} of Readli Family: classic children's books read in the voices of the people your kids love.`,
    ...(input.message ? ["", `${who} wrote:`, input.message] : []),
    "",
    `Open your gift: ${input.openUrl}`,
    `Your gift code: ${input.code}`,
    "",
    "It's already paid for. You won't be asked for a card, and it never turns into a paid plan.",
    "",
    `You're getting this because ${who} bought you a gift on Readli. We don't add you to any mailing list.`,
  ];
  const message = input.message
    ? `<p style="margin:16px 0 4px;font-weight:600">${esc(who)} wrote:</p><p style="margin:0;padding:12px 16px;background:#fff7e0;border-radius:12px;white-space:pre-line">${esc(input.message)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2a2340">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:700;margin:0 0 16px">Readli</p>
<div style="background:#ffffff;border-radius:20px;padding:24px">
<p style="margin:0 0 12px">${esc(hello)}</p>
<p style="margin:0">${esc(who)} gave your family <strong>${esc(input.planName)}</strong> of Readli Family: classic children's books read in the voices of the people your kids love.</p>
${message}
<p style="margin:24px 0 8px;text-align:center"><a href="${esc(input.openUrl)}" style="display:inline-block;background:#ff7a59;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">Open your gift</a></p>
<p style="margin:0 0 16px;text-align:center;font-size:14px">Your gift code: <strong style="letter-spacing:1px">${esc(input.code)}</strong></p>
<p style="margin:0;font-size:14px">It's already paid for. You won't be asked for a card, and it never turns into a paid plan.</p>
</div>
<p style="font-size:12px;color:#6b6480;margin:16px 0 0">You're getting this because ${esc(who)} bought you a gift on Readli. We don't add you to any mailing list. <a href="${esc(input.oneClickUnsubscribeUrl)}" style="color:#6b6480">Stop Readli emails</a></p>
</div></body></html>`;
  return {
    subject,
    html,
    text: lines.join("\n"),
    headers: { "List-Unsubscribe": `<${input.oneClickUnsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
