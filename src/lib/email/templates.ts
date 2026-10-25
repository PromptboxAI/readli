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
  preferencesUrl: string;
  /** One-click unsubscribe headers, for optional email. */
  headers?: Record<string, string>;
  /** Footer line for optional email: "Stop setup reminders". */
  stopLabel?: string;
}

export function readliEmail(input: ReadliEmailInput): EmailMessage {
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const settings = input.stopLabel ? `${input.stopLabel} or change your email settings` : "Email settings";
  const text = [hello, "", input.title, "", ...input.paragraphs.flatMap((p) => [p, ""]), `${input.cta.label}: ${input.cta.url}`, "", input.reason, `${settings}: ${input.preferencesUrl}`].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2a2340">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:700;margin:0 0 16px">Readli</p>
<div style="background:#ffffff;border-radius:20px;padding:24px">
<p style="margin:0 0 12px">${esc(hello)}</p>
<p style="margin:0 0 12px;font-size:20px;font-weight:700">${esc(input.title)}</p>
${input.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join("\n")}
<p style="margin:24px 0 0;text-align:center"><a href="${esc(input.cta.url)}" style="display:inline-block;background:#ff7a59;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px">${esc(input.cta.label)}</a></p>
</div>
<p style="font-size:12px;color:#6b6480;margin:16px 0 0">${esc(input.reason)} <a href="${esc(input.preferencesUrl)}" style="color:#6b6480">${esc(settings)}</a></p>
</div></body></html>`;
  return { subject: input.subject, html, text, headers: input.headers ?? {} };
}
