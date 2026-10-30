import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { familyInviteEmail, MemoryMailer } from "@/lib/invitations/email";
import { respondToken } from "@/lib/invitations/server";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { emailNewInvite, householdInviteIdFromRespondToken, householdRespondToken, resendInvite, respondToHouseholdInvite } from "./email";
import { hashInviteToken } from "./server";

type Row = Record<string, unknown>;
const SECRET = "test-secret";
const ID = "11111111-1111-4111-8111-111111111111";

/** Enough of the Supabase query builder for invitation email. */
function fakeDb(tables: Record<string, Row[]>, rpc: (name: string, args: Row) => unknown) {
  const t = (name: string) => (tables[name] ??= []);
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; values: Row } = { kind: "select" };
    const run = () => {
      if (op.kind === "insert") {
        t(name).push(...op.rows.map((r, i) => ({ id: t(name).length + i + 1, ...r })));
        return { data: op.rows, error: null };
      }
      const hits = t(name).filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") for (const r of hits) Object.assign(r, op.values);
      return { data: hits.map((r) => ({ ...r })), error: null };
    };
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      insert: (rows: Row | Row[]) => ((op = { kind: "insert", rows: [rows].flat() }), q),
      update: (values: Row) => ((op = { kind: "update", values }), q),
      maybeSingle: async () => {
        const { data } = run();
        return { data: data[0] ?? null, error: null };
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  return { from, rpc: async (n: string, a: Row) => ({ data: rpc(n, a), error: null }) } as unknown as SupabaseClient;
}

function world(rpcResult = "sent") {
  const tables: Record<string, Row[]> = {
    voice_invitation_settings: [{ id: true, sending_enabled: true, max_resends: 3, link_days: 14 }],
    household_invitations: [
      {
        id: ID,
        household_id: "h1",
        inviter_id: "sara",
        invitee_name: "Mommy",
        token_hash: hashInviteToken("first"),
        recipient_email_hash: "hash",
        recipient_email_encrypted: new ProviderRefCipher(SECRET).encrypt("andrea@example.com"),
        sent_count: 0,
        accepted_at: null,
      },
    ],
    households: [{ id: "h1", name: "The Godfrey family" }],
    adult_profiles: [{ user_id: "sara", display_name: "Kevin" }],
  };
  const calls: Row[] = [];
  const db = fakeDb(tables, (name, args) => {
    calls.push({ name, ...args });
    if (rpcResult === "sent") {
      const inv = tables.household_invitations![0]!;
      inv.token_hash = args.p_token_hash;
      inv.sent_count = Number(inv.sent_count) + 1;
      (tables.household_invitation_sends ??= []).push({ id: calls.length, invitation_id: ID, delivery: "queued" });
    }
    return rpcResult;
  });
  return { db, tables, calls, mailer: new MemoryMailer() };
}

describe("family storyteller invitation email", () => {
  it("goes out with the link the parent already has, and decline, unsubscribe and report links", async () => {
    const { db, tables, calls, mailer } = world();
    expect(await emailNewInvite(db, { secret: SECRET, origin: "https://readli.ai", mailer }, "sara", ID, "first")).toBe("sent");
    expect(calls[0]).toEqual({ name: "send_household_invitation", p_inviter: "sara", p_invitation: ID, p_token_hash: hashInviteToken("first") });
    const [mail] = mailer.sent;
    expect(mail!.to).toBe("andrea@example.com");
    expect(mail!.subject).toBe("Kevin invited you to read stories to The Godfrey family on Readli");
    expect(mail!.text).toContain("https://readli.ai/voice/join?invite=first");
    expect(mail!.text).toContain(`/v/respond/${householdRespondToken(SECRET, ID)}?action=decline`);
    expect(mail!.text).toContain("free for you and takes about three minutes");
    expect(mail!.headers["List-Unsubscribe"]).toBe(`<https://readli.ai/api/invitations/unsubscribe/${householdRespondToken(SECRET, ID)}>`);
    expect(tables.household_invitation_sends![0]!.delivery).toBe("sent");
  });

  it("isn't sent when the address is suppressed, a limit is reached or email is off", async () => {
    for (const result of ["suppressed", "daily_limit", "resend_limit"]) {
      const { db, mailer } = world(result);
      expect(await emailNewInvite(db, { secret: SECRET, origin: "https://readli.ai", mailer }, "sara", ID, "first")).toBe(result);
      expect(mailer.sent).toHaveLength(0);
    }
    const { db, calls } = world("switched_off");
    expect(await emailNewInvite(db, { secret: SECRET, origin: "https://readli.ai", mailer: null }, "sara", ID, "first")).toBe("off");
    expect(calls).toHaveLength(0);
  });

  it("resends with a fresh link only when a send was recorded", async () => {
    const { db, tables, mailer } = world();
    const ctx = { secret: SECRET, origin: "https://readli.ai", mailer };
    const out = await resendInvite(db, ctx, "h1", "sara", ID);
    expect(out.email).toBe("sent");
    const token = new URL(out.link!).searchParams.get("invite")!;
    expect(token).not.toBe("first");
    expect(tables.household_invitations![0]!.token_hash).toBe(hashInviteToken(token));
    await expect(resendInvite(db, ctx, "other-family", "sara", ID)).rejects.toMatchObject({ status: 404 });

    const limited = world("resend_limit");
    expect(await resendInvite(limited.db, { ...ctx, mailer: limited.mailer }, "h1", "sara", ID)).toEqual({ link: null, email: "resend_limit" });
    expect(limited.tables.household_invitations![0]!.token_hash).toBe(hashInviteToken("first"));
  });

  it("respond links are signed, separate from Readli Voice invitation links, and close the invitation", async () => {
    const token = householdRespondToken(SECRET, ID);
    expect(householdInviteIdFromRespondToken(SECRET, token)).toBe(ID);
    expect(householdInviteIdFromRespondToken(SECRET, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(householdInviteIdFromRespondToken("other-secret", token)).toBeNull();
    expect(householdInviteIdFromRespondToken(SECRET, respondToken(SECRET, ID))).toBeNull();

    const decline = world();
    expect(await respondToHouseholdInvite(decline.db, SECRET, token, "decline")).toBe(true);
    expect(decline.tables.email_suppressions).toMatchObject([{ email_hash: "hash", contributor_id: "sara", reason: "declined" }]);
    expect(decline.tables.household_invitations![0]!.declined_at).toBeTruthy();

    const unsub = world();
    await respondToHouseholdInvite(unsub.db, SECRET, token, "unsubscribe");
    expect(unsub.tables.email_suppressions).toMatchObject([{ email_hash: "hash", contributor_id: null, reason: "unsubscribed" }]);

    const report = world();
    await respondToHouseholdInvite(report.db, SECRET, token, "report", { reason: "dont_know", details: "Who?" });
    expect(report.tables.voice_invitation_reports).toMatchObject([{ household_invitation_id: ID, contributor_id: "sara", reason: "dont_know", details: "Who?" }]);
    expect(report.tables.household_invitations![0]!.reported_at).toBeTruthy();
    expect(await respondToHouseholdInvite(report.db, SECRET, "h.nope.x", "decline")).toBe(false);
  });

  it("escapes names in the email", () => {
    const mail = familyInviteEmail({
      inviterName: "<b>Kev</b>",
      familyName: "The Godfreys",
      recipientName: "",
      joinUrl: "https://readli.ai/voice/join?invite=x",
      declineUrl: "d",
      unsubscribeUrl: "u",
      oneClickUnsubscribeUrl: "o",
      reportUrl: "r",
      linkDays: 14,
    });
    expect(mail.html).not.toContain("<b>Kev</b>");
    expect(mail.html).toContain("&lt;b&gt;Kev&lt;/b&gt;");
    expect(mail.text.startsWith("Hi,")).toBe(true);
  });

  it("asks a co-parent to join as a parent, not to record", () => {
    const input = { inviterName: "Kev", familyName: "The Godfreys", recipientName: "Ben", joinUrl: "j", declineUrl: "d", unsubscribeUrl: "u", oneClickUnsubscribeUrl: "o", reportUrl: "r", linkDays: 14 };
    const mail = familyInviteEmail({ ...input, coParent: true });
    expect(mail.subject).toBe("Kev invited you to be a parent in The Godfreys on Readli");
    expect(mail.text).toContain("Kev looks after the family's plan and billing");
    expect(mail.text).not.toContain("read stories to the kids");
    expect(familyInviteEmail({ ...input, coParent: true, reminder: true }).subject).toBe("Kev is still waiting for you to join The Godfreys on Readli");
    expect(familyInviteEmail(input).subject).toBe("Kev invited you to read stories to The Godfreys on Readli");
  });
});
