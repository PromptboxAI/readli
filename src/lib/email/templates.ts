import type { EmailMessage } from "./outbox";

/**
 * The one layout every automated Readli email uses: the same look as invitation email, one button,
 * plain-text twin, and a footer that always links to email settings. No tracking pixels and no click
 * tracking.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ReadliEmailInput {
  subject: string;
  /** First name, or empty for a plain "Hi,". */
  name: string;
  title: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  /** Why they're getting it, e.g. "You're getting this because you started Readli Family." */
  reason: string;
  /** Email settings link; left out for someone without an account (a guest's demo). */
  preferencesUrl?: string;
  /** One-click unsubscribe headers, for optional email. */
  headers?: Record<string, string>;
  /** Footer line for optional email: "Stop setup reminders". */
  stopLabel?: string;
  /** Replaces the footer link's whole label, e.g. "Unsubscribe" for someone without an account. */
  footerLabel?: string;
  /** Book cards after the paragraphs (Bedtime Thursdays). */
  books?: { title: string; byline: string; url: string; imageUrl: string | null }[];
}

export function readliEmail(input: ReadliEmailInput): EmailMessage {
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const settings = input.footerLabel ?? (input.stopLabel ? `${input.stopLabel} or change your email settings` : "Email settings");
  const books = input.books ?? [];
  const text = [
    hello,
    "",
    input.title,
    "",
    ...input.paragraphs.flatMap((p) => [p, ""]),
    ...books.flatMap((b) => [`${b.title}, ${b.byline}: ${b.url}`, ""]),
    `${input.cta.label}: ${input.cta.url}`,
    "",
    input.reason,
    ...(input.preferencesUrl ? [`${settings}: ${input.preferencesUrl}`] : []),
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2a2340">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:700;margin:0 0 16px">Readli</p>
<div style="background:#ffffff;border-radius:20px;padding:24px">
<p style="margin:0 0 12px">${esc(hello)}</p>
<p style="margin:0 0 12px;font-size:20px;font-weight:700">${esc(input.title)}</p>
${input.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join("\n")}
${books
  .map(
    (b) =>
      `<a href="${esc(b.url)}" style="display:block;margin:12px 0;color:#2a2340;text-decoration:none">${b.imageUrl ? `<img src="${esc(b.imageUrl)}" alt="" width="96" style="float:left;width:96px;border-radius:12px;margin:0 16px 0 0">` : ""}<span style="display:block;font-weight:700;font-size:18px">${esc(b.title)}</span><span style="display:block;color:#6b6480">${esc(b.byline)}</span><span style="display:block;clear:both"></span></a>`,
  )
  .join("\n")}
<p style="margin:24px 0 0;text-align:center"><a href="${esc(input.cta.url)}" style="display:inline-block;background:#ff7a59;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">${esc(input.cta.label)}</a></p>
</div>
<p style="font-size:12px;color:#6b6480;margin:16px 0 0">${esc(input.reason)}${input.preferencesUrl ? ` <a href="${esc(input.preferencesUrl)}" style="color:#6b6480">${esc(settings)}</a>` : ""}</p>
</div></body></html>`;
  return { subject: input.subject, html, text, headers: input.headers ?? {} };
}
