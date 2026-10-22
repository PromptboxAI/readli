import { describe, expect, it } from "vitest";
import { findCatalogBook } from "@/lib/library/catalog";
import { invitationEmail } from "./email";
import { cleanMessage, invitationStatus, normalizeEmail, parseRecipients } from "./invitations";
import { PREVIEW_PASSAGES } from "./passages";
import { funnelFromRows } from "./report";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("family invitations", () => {
  it("derive a status a contributor can read, never from an email pixel", () => {
    const future = "2026-10-26T00:00:00Z";
    const now = new Date("2026-10-12T00:00:00Z");
    expect(invitationStatus({ expires_at: future }, now)).toBe("pending");
    expect(invitationStatus({ expires_at: future, opened_at: "2026-10-12T00:00:00Z" }, now)).toBe("opened");
    expect(invitationStatus({ expires_at: "2026-10-11T00:00:00Z" }, now)).toBe("expired");
    expect(invitationStatus({ expires_at: future, accepted_at: "x" }, now)).toBe("accepted");
    expect(invitationStatus({ expires_at: future, reported_at: "x" }, now)).toBe("declined");
    expect(invitationStatus({ expires_at: future, revoked_at: "x", accepted_at: null }, now)).toBe("revoked");
  });

  it("clean the composer's rows: skip blanks, flag bad emails, drop repeats", () => {
    const { recipients, problems, duplicates } = parseRecipients([
      { name: " Sara ", relationship: "Son or daughter", email: " Sara@Example.com " },
      { name: "", relationship: "", email: "" },
      { name: "Sam", email: "not-an-email" },
      { name: "Again", email: "sara@example.com" },
      { name: "<b>Ted</b>", email: "ted@example.org" },
    ]);
    expect(recipients).toEqual([
      { email: "sara@example.com", name: "Sara", relationship: "Son or daughter" },
      { email: "ted@example.org", name: "b Ted /b", relationship: "" },
    ]);
    expect(problems).toEqual([{ row: 2, problem: "email" }]);
    expect(duplicates).toBe(1);
    expect(normalizeEmail("a@b")).toBeNull();
    expect(cleanMessage("Hi <script>\n\n\n\nLove")).toBe("Hi  script \n\nLove");
    expect(cleanMessage("x".repeat(900))).toHaveLength(500);
  });

  it("offer only curated passages copied word for word, 30 to 45 seconds long", () => {
    expect(new Set(PREVIEW_PASSAGES.map((p) => p.id)).size).toBe(PREVIEW_PASSAGES.length);
    for (const p of PREVIEW_PASSAGES) {
      const book = findCatalogBook(p.book);
      expect(book, p.id).not.toBeNull();
      expect(squash(book!.chapters[p.chapter]!.text)).toContain(squash(p.text));
      const words = p.text.split(/\s+/).length;
      expect(words, p.id).toBeGreaterThanOrEqual(70);
      expect(words, p.id).toBeLessThanOrEqual(115);
    }
  });

  it("write a branded email with no tracking and one-click unsubscribe", () => {
    const email = invitationEmail({
      contributorName: "June <Walker>",
      recipientName: "Sara",
      message: "Love, Mom",
      bookTitle: "Winnie-the-Pooh",
      previewUrl: "https://readli.ai/v/tok",
      declineUrl: "https://readli.ai/v/respond/r?action=decline",
      unsubscribeUrl: "https://readli.ai/v/respond/r?action=unsubscribe",
      oneClickUnsubscribeUrl: "https://readli.ai/api/invitations/unsubscribe/r",
      reportUrl: "https://readli.ai/v/respond/r?action=report",
      linkDays: 14,
    });
    expect(email.subject).toBe("June <Walker> wants to read stories to your family on Readli");
    expect(email.html).toContain("June &lt;Walker&gt;");
    expect(email.html).not.toMatch(/<img/i);
    expect(email.html).toContain("https://readli.ai/v/tok");
    expect(email.text).toContain("Stop all Readli invitations: https://readli.ai/v/respond/r?action=unsubscribe");
    expect(email.headers).toEqual({ "List-Unsubscribe": "<https://readli.ai/api/invitations/unsubscribe/r>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("report the funnel without personal data, counting only attributed paying families' recurring revenue", () => {
    const f = funnelFromRows({
      days: 90,
      events: [
        { name: "invite_preview_generated", properties: { book: "winnie-the-pooh" } },
        { name: "invite_preview_generated", properties: { book: "winnie-the-pooh" } },
        { name: "invite_landing_viewed", properties: { invitation_id: "i1" } },
        { name: "invite_landing_viewed", properties: { invitation_id: "i1" } },
        { name: "invite_audio_played", properties: { invitation_id: "i1" } },
      ],
      invitations: [
        { recipient_email_hash: "a", household_id: "h1", accepted_at: "x", trial_started_at: "x", converted_at: "x" },
        { recipient_email_hash: "a" },
        { recipient_email_hash: "b", declined_at: "x" },
      ],
      revenue: [
        { household_id: "h1", kind: "subscription", amount_cents: 17999, billing_interval: "year", occurred_at: "2026-10-01" },
        { household_id: "h1", kind: "credit_pack", amount_cents: 999, occurred_at: "2026-10-02" },
        { household_id: "h2", kind: "subscription", amount_cents: 1999, billing_interval: "month", occurred_at: "2026-10-02" },
      ],
    });
    expect(f).toMatchObject({ previewsGenerated: 2, books: [{ slug: "winnie-the-pooh", previews: 2 }], invitationsSent: 3, uniqueRecipients: 2, pagesOpened: 1, previewsPlayed: 1, accepted: 1, payingHouseholds: 1, attributedMrrCents: 1500, declined: 1 });
  });
});

describe("invitation email setup", () => {
  it("use Readli's shared Resend key and sender, with an optional invites address", async () => {
    const { invitationMailer, ResendMailer } = await import("./email");
    expect(invitationMailer({ RESEND_API_KEY: "re_x" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(invitationMailer({ RESEND_API_KEY: "re_x", EMAIL_FROM: "Readli <hello@readli.ai>" } as unknown as NodeJS.ProcessEnv)).toBeInstanceOf(ResendMailer);
    const sent: { body: string }[] = [];
    const mailer = new ResendMailer("re_x", "Readli <invites@readli.ai>", (async (_url: string, init: { body: string }) => {
      sent.push(init);
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }) as unknown as typeof fetch);
    expect(await mailer.send({ to: "a@b.co", subject: "s", html: "h", text: "t", headers: {} })).toEqual({ id: "em_1" });
    expect(JSON.parse(sent[0]!.body)).toMatchObject({ from: "Readli <invites@readli.ai>", to: ["a@b.co"] });
  });
});
