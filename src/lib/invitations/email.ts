import { DEFAULT_CONTRIBUTOR_MESSAGE } from "./invitations";

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
  /** Resend drops a second send with the same key, so a retried request never emails twice. */
  idempotencyKey?: string;
}

export interface Mailer {
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

export class MailerError extends Error {
  constructor(
    message: string,
    /** Resend's HTTP status, when it answered. */
    readonly status?: number,
  ) {
    super(message);
  }
}

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(email: OutgoingEmail) {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        ...(email.idempotencyKey ? { "idempotency-key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, html: email.html, text: email.text, headers: email.headers }),
    });
    if (!res.ok) throw new MailerError(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
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
  /** The approved preview's book, or null when the contributor sent no preview. */
  bookTitle: string | null;
  /** A public JPG of that book's cover (see emailCoverUrl), or null. Never anything private. */
  coverUrl?: string | null;
  /** The invitation page: hear the preview, connect an existing family or start Readli Family. */
  previewUrl: string;
  declineUrl: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
  reportUrl: string;
  linkDays: number;
  /** An automatic reminder (sequence email I2) rather than the first invitation. */
  reminder?: boolean;
  /** When the link stops working; defaults to linkDays from now. */
  now?: Date;
}

const REMINDER_LINE = "A quick reminder: this invitation is still open.";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Books with an email-safe JPG cover in public/email-covers: the ones a preview can be made from. */
const EMAIL_COVERS = new Set([
  "aesops-fables-retold",
  "alices-adventures-in-wonderland",
  "goldilocks-and-the-three-bears",
  "the-elves-and-the-shoemaker",
  "the-gingerbread-man",
  "the-lion-and-the-mouse",
  "the-little-red-hen",
  "the-princess-and-the-pea",
  "the-tale-of-peter-rabbit",
  "the-three-little-pigs",
  "the-ugly-duckling",
  "the-velveteen-rabbit",
  "winnie-the-pooh",
]);

/**
 * A book cover the email can show in every client (JPG, since Outlook can't show WebP), from Readli's
 * own public files: the image host learns only which public cover was opened, never a token or household.
 */
export function emailCoverUrl(origin: string, slug: string | null | undefined): string | null {
  return slug && EMAIL_COVERS.has(slug) ? `${origin.replace(/\/$/, "")}/email-covers/${slug}.jpg` : null;
}

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/**
 * A storyteller shares their voice with a family. Built around the approved preview: who, their
 * note, the book's cover and one button to hear it. The button opens the invitation page (the
 * preview plays there), never checkout, and no audio is in the email.
 */
export function invitationEmail(input: InvitationEmailInput): Omit<OutgoingEmail, "to"> {
  const who = input.contributorName;
  const book = input.bookTitle;
  const said = input.message || DEFAULT_CONTRIBUTOR_MESSAGE;
  const headline = `${who} has a bedtime story for your family.`;
  const subject = input.reminder ? `Still waiting: ${who} has a bedtime story for your family` : `${who} has a bedtime story for your family`;
  const cta = `Hear ${who} read a story`;
  const hear = book ? `Hear ${who}'s voice reading ${book}.` : null;
  const support = `Already have Readli Family? Connect ${who} in a few taps. New to Readli? You can start Readli Family from the same page.`;
  const expires = longDate(new Date((input.now ?? new Date()).getTime() + input.linkDays * 86_400_000));
  const origin = new URL(input.previewUrl).origin;
  const lines = [
    ...(input.recipientName ? [`Hi ${input.recipientName},`, ""] : []),
    ...(input.reminder ? [REMINDER_LINE, ""] : []),
    headline,
    "",
    `"${said}"`,
    `${who}`,
    "",
    ...(hear ? [hear, ""] : []),
    `${cta}: ${input.previewUrl}`,
    "",
    support,
    "",
    `This invitation expires on ${expires}.`,
    `Not for you? Decline: ${input.declineUrl}`,
    `Stop all Readli invitations: ${input.unsubscribeUrl}`,
    `Report this email: ${input.reportUrl}`,
    "",
    `You're getting this because ${who} entered your email address on Readli. We don't add you to any mailing list.`,
  ];
  const cover = input.coverUrl
    ? `<tr><td align="center" style="padding:4px 0 16px"><img src="${esc(input.coverUrl)}" width="200" height="267" alt="${esc(book ? `${book} book cover` : "Book cover")}" style="display:block;width:200px;height:267px;border:0;border-radius:14px;background:#f7e6cc;color:#283548;font:bold 14px Arial,Helvetica,sans-serif;text-align:center"></td></tr>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff9ed;font-family:Arial,Helvetica,sans-serif;color:#283548">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff9ed" style="background:#fff9ed"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 16px"><img src="${esc(origin)}/email-covers/readi.png" width="48" height="33" alt="" style="display:inline-block;vertical-align:middle;border:0"> <span style="display:inline-block;vertical-align:middle;font-size:26px;font-weight:700;color:#c9402f">Readli</span></td></tr>
<tr><td bgcolor="#fffef9" style="background:#fffef9;border-radius:24px;padding:28px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${input.reminder ? `<tr><td align="center" style="padding:0 0 8px;font-size:14px;color:#5b6676">${REMINDER_LINE}</td></tr>
` : ""}<tr><td align="center" style="padding:0 0 16px;font-size:26px;line-height:1.25;font-weight:700">${esc(headline)}</td></tr>
<tr><td align="center" style="padding:0 0 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:420px"><tr><td bgcolor="#fff3c9" style="background:#fff3c9;border-radius:18px 18px 18px 4px;padding:12px 16px;font-size:16px;line-height:1.45;text-align:left;white-space:pre-line">${esc(said)}<br><span style="font-size:13px;color:#5b6676">${esc(who)}</span></td></tr></table></td></tr>
${cover}${book ? `<tr><td align="center" style="padding:0 0 4px;font-size:21px;font-weight:700">${esc(book)}</td></tr>
<tr><td align="center" style="padding:0 0 20px;font-size:16px">${esc(hear!)}</td></tr>
` : ""}<tr><td align="center" style="padding:0 0 18px"><a href="${esc(input.previewUrl)}" style="display:inline-block;background:#c9402f;color:#ffffff;text-decoration:none;font-weight:700;font-size:18px;line-height:1.2;padding:16px 28px;border-radius:999px">&#9654;&nbsp; ${esc(cta)}</a></td></tr>
<tr><td align="center" style="font-size:14px;line-height:1.5;color:#5b6676">${esc(support)}</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:16px 8px 0;font-size:12px;line-height:1.6;color:#5b6676">This invitation expires on ${esc(expires)}.<br>Not for you? <a href="${esc(input.declineUrl)}" style="color:#5b6676">Decline</a> · <a href="${esc(input.unsubscribeUrl)}" style="color:#5b6676">Stop all Readli invitations</a> · <a href="${esc(input.reportUrl)}" style="color:#5b6676">Report this email</a><br>You're getting this because ${esc(who)} entered your email address on Readli. We don't add you to any mailing list.</td></tr>
</table></td></tr></table></body></html>`;
  return {
    subject,
    html,
    text: lines.join("\n"),
    headers: { "List-Unsubscribe": `<${input.oneClickUnsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export interface ConnectedEmailInput {
  contributorName: string;
  familyName: string;
  manageUrl: string;
}

/** Tells a contributor a family connected their voice, and where to stop sharing. */
export function connectedEmail(input: ConnectedEmailInput): Omit<OutgoingEmail, "to"> {
  const lines = [
    `Hi ${input.contributorName},`,
    "",
    `Good news: ${input.familyName} connected your Readli voice, so their kids can hear stories read by you.`,
    "",
    `See the families who hear you read: ${input.manageUrl}`,
  ];
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2a2340">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:700;margin:0 0 16px">Readli</p>
<div style="background:#ffffff;border-radius:20px;padding:24px">
<p style="margin:0 0 12px">Hi ${esc(input.contributorName)},</p>
<p style="margin:0">Good news: <strong>${esc(input.familyName)}</strong> connected your Readli voice, so their kids can hear stories read by you.</p>
<p style="margin:24px 0 0;text-align:center"><a href="${esc(input.manageUrl)}" style="display:inline-block;background:#ff7a59;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">See my families</a></p>
</div></div></body></html>`;
  return { subject: `${input.familyName} connected your Readli voice`, html, text: lines.join("\n"), headers: {} };
}

export interface FamilyInviteEmailInput {
  inviterName: string;
  familyName: string;
  recipientName: string;
  joinUrl: string;
  declineUrl: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
  reportUrl: string;
  linkDays: number;
  /** An automatic reminder (sequence email I1) rather than the first invitation. */
  reminder?: boolean;
  /** Invites a second parent (Settings → Parents) rather than a storyteller. */
  coParent?: boolean;
}

/** A family's parent invites a storyteller (Family storytellers → Invite a storyteller), or a co-parent. */
export function familyInviteEmail(input: FamilyInviteEmailInput): Omit<OutgoingEmail, "to"> {
  const who = input.inviterName;
  const family = input.familyName;
  const hello = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const subject = input.coParent
    ? input.reminder
      ? `${who} is still waiting for you to join ${family} on Readli`
      : `${who} invited you to be a parent in ${family} on Readli`
    : input.reminder
      ? `${who} is still saving a spot for your voice`
      : `${who} invited you to read stories to ${family} on Readli`;
  const intro = input.coParent
    ? `${who} would love you to join ${family} on Readli as a parent. You'll share the family's account: choose which storytellers each child hears, prepare books, and open Readli Kids on your own phone or tablet.`
    : `${who} would love you to read stories to the kids in ${family}. On Readli, you record your voice once, and the children your family's parents choose can hear you read classic books.`;
  const terms = input.coParent
    ? `It's free for you: ${who} looks after the family's plan and billing. Recording your own voice for the kids is optional. The link works once, for ${input.linkDays} days.`
    : `It's free for you and takes about three minutes. This link is just for you and works for ${input.linkDays} days.`;
  const lines = [
    hello,
    "",
    ...(input.reminder ? [REMINDER_LINE, ""] : []),
    intro,
    "",
    `Accept the invitation: ${input.joinUrl}`,
    "",
    terms,
    "",
    `Not for you? Decline: ${input.declineUrl}`,
    `Stop all Readli invitations: ${input.unsubscribeUrl}`,
    `Report this email: ${input.reportUrl}`,
    "",
    `You're getting this because ${who} entered your email address on Readli. We don't add you to any mailing list.`,
  ];
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2a2340">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:700;margin:0 0 16px">Readli</p>
<div style="background:#ffffff;border-radius:20px;padding:24px">
<p style="margin:0 0 12px">${esc(hello)}</p>
${input.reminder ? `<p style="margin:0 0 12px">${REMINDER_LINE}</p>\n` : ""}<p style="margin:0">${esc(intro)}</p>
<p style="margin:24px 0;text-align:center"><a href="${esc(input.joinUrl)}" style="display:inline-block;background:#ff7a59;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">Accept the invitation</a></p>
<p style="margin:0;font-size:14px">${esc(terms)}</p>
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

export interface ReadyEmailInput {
  parentName: string;
  title: string;
  body: string;
  cta: string;
  ctaUrl: string;
}

/** To the parent who invited a storyteller: their voice is ready and shared with the family. */
export function storytellerReadyEmail(input: ReadyEmailInput): Omit<OutgoingEmail, "to"> {
  const lines = [`Hi ${input.parentName},`, "", input.title, input.body, "", `${input.cta}: ${input.ctaUrl}`];
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2a2340">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:700;margin:0 0 16px">Readli</p>
<div style="background:#ffffff;border-radius:20px;padding:24px">
<p style="margin:0 0 12px">Hi ${esc(input.parentName)},</p>
<p style="margin:0 0 12px;font-size:20px;font-weight:700">${esc(input.title)}</p>
<p style="margin:0">${esc(input.body)}</p>
<p style="margin:24px 0;text-align:center"><a href="${esc(input.ctaUrl)}" style="display:inline-block;background:#ff7a59;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">${esc(input.cta)}</a></p>
</div></div></body></html>`;
  return { subject: input.title, html, text: lines.join("\n"), headers: {} };
}
