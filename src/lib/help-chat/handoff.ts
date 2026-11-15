import type { OutgoingEmail } from "@/lib/invitations/email";
import type { ChatTurn } from "./limits";

/**
 * "Talk to a person" (Kevin, 2026-11-15): the chat goes to support by email with the person's
 * address as Reply-To, so nobody has to repeat themselves and support answers from their inbox.
 */

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Handoff = { email: string; name: string; note: string; transcript: ChatTurn[]; page: string };

export function parseHandoff(body: Record<string, unknown>): { ok: true; handoff: Handoff } | { ok: false; message: string } {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, message: "Please enter an email address we can reply to." };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const page = typeof body.page === "string" && body.page.startsWith("/") ? body.page.slice(0, 200) : "";
  const transcript = (Array.isArray(body.transcript) ? body.transcript : [])
    .filter((m): m is ChatTurn => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!note && !transcript.some((m) => m.role === "user")) return { ok: false, message: "Please tell us what you need help with." };
  return { ok: true, handoff: { email, name, note, transcript, page } };
}

export function handoffEmail(h: Handoff, to: string): OutgoingEmail {
  const who = h.name ? `${h.name} <${h.email}>` : h.email;
  const firstQuestion = h.transcript.find((m) => m.role === "user")?.content ?? h.note;
  const subject = `Help chat: ${firstQuestion.replace(/\s+/g, " ").slice(0, 70)}`;
  const label = (m: ChatTurn) => (m.role === "user" ? "Them" : "Readli assistant");

  const text = [
    `From: ${who}`,
    h.page ? `Page: ${h.page}` : "",
    "",
    h.note ? `Their message:\n${h.note}\n` : "",
    h.transcript.length ? "Chat so far:" : "",
    ...h.transcript.map((m) => `${label(m)}: ${m.content}\n`),
    "Reply to this email to answer them directly.",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#2a2440">
<p><strong>From:</strong> ${esc(who)}${h.page ? `<br><strong>Page:</strong> ${esc(h.page)}` : ""}</p>
${h.note ? `<p><strong>Their message:</strong><br>${esc(h.note).replace(/\n/g, "<br>")}</p>` : ""}
${h.transcript.length ? "<p><strong>Chat so far:</strong></p>" : ""}
${h.transcript
  .map(
    (m) =>
      `<p style="margin:0 0 10px;padding:8px 12px;border-radius:10px;background:${m.role === "user" ? "#fdf1d6" : "#eef6f1"}"><strong>${label(m)}:</strong><br>${esc(m.content).replace(/\n/g, "<br>")}</p>`,
  )
  .join("\n")}
<p style="color:#6b6680">Reply to this email to answer them directly.</p>
</div>`;

  return { to, subject, text, html, headers: {}, replyTo: h.email };
}
