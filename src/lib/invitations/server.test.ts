import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { hashGiftCode } from "@/lib/gifting/codes.server";
import { MemoryMailer } from "./email";
import {
  acceptInvitation,
  approvePreview,
  emailHash,
  generatePreview,
  PREVIEWS_PER_HOUR,
  giftPreview,
  playGiftPreview,
  hashInvitationToken,
  invitationIdFromRespondToken,
  maskEmail,
  noteInvitedStoryPlayed,
  recipientEvent,
  respond,
  respondToken,
  sendInvitations,
  settingsUpdate,
  type PreviewDeps,
} from "./server";

type Row = Record<string, unknown>;
const SECRET = "test-secret";
const ID = "11111111-2222-3333-4444-555555555555";

/** Enough of the Supabase client for the invitation code: filters, inserts, updates, storage, rpc and auth. */
function fakeDb(tables: Record<string, Row[]> = {}, rpc: (name: string, args: Row) => unknown = () => null) {
  const calls: { name: string; args: Row }[] = [];
  const storage: { bucket: string; op: string; keys: string[] }[] = [];
  const t = (name: string) => (tables[name] ??= []);
  let seq = 0;
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "insert" | "update" = "select";
    let payload: Row = {};
    let one: "single" | "maybe" | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      not: (k: string) => (filters.push((r) => (r[k] ?? null) !== null), q),
      gte: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "") >= v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      contains: (k: string, v: Row) => (filters.push((r) => Object.entries(v).every(([kk, vv]) => (r[k] as Row | undefined)?.[kk] === vv)), q),
      insert: (row: Row) => ((op = "insert"), (payload = row), q),
      update: (row: Row) => ((op = "update"), (payload = row), q),
      single: () => ((one = "single"), q),
      maybeSingle: () => ((one = "maybe"), q),
      then: (resolve: (v: unknown) => void) => {
        let data: Row[];
        if (op === "insert") {
          const row = { id: `${name}-${++seq}`, created_at: new Date().toISOString(), ...payload };
          t(name).push(row);
          data = [row];
        } else {
          data = t(name).filter((r) => filters.every((f) => f(r)));
          if (op === "update") for (const r of data) Object.assign(r, payload);
        }
        resolve({ data: one ? (data[0] ?? null) : data, error: null, count: data.length });
      },
    };
    return q;
  };
  const db = {
    from,
    rpc: async (name: string, args: Row) => (calls.push({ name, args }), { data: rpc(name, args), error: null }),
    storage: {
      from: (bucket: string) => ({
        upload: async (key: string) => (storage.push({ bucket, op: "upload", keys: [key] }), { error: null }),
        remove: async (keys: string[]) => (storage.push({ bucket, op: "remove", keys }), { error: null }),
        createSignedUrl: async (key: string) => ({ data: { signedUrl: `https://signed/${key}` }, error: null }),
      }),
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email_confirmed_at: "2026-10-01" } }, error: null }) } },
  };
  return { db: db as unknown as SupabaseClient, tables, calls, storage };
}

const voice = { id: "v1", status: "ready", version: 2, providerVoiceId: "el-1" };
const deps = (synth: string[] = []): PreviewDeps => ({
  findVoice: async () => voice,
  provider: {
    synthesize: async ({ text }) => (synth.push(text), { audio: new ArrayBuffer(8), contentType: "audio/mpeg", standIn: false }),
    createInstantVoice: async () => ({ voiceId: "x" }),
    deleteVoice: async () => {},
  },
});
const settings = (over: Row = {}) => ({ id: true, sending_enabled: true, max_recipients_per_send: 10, max_recipients_per_day: 30, max_resends: 3, link_days: 14, ...over });

describe("family invitations on the server", () => {
  it("sign decline and unsubscribe links so they can't be guessed or edited", () => {
    const tok = respondToken(SECRET, ID);
    expect(invitationIdFromRespondToken(SECRET, tok)).toBe(ID);
    expect(invitationIdFromRespondToken("other", tok)).toBeNull();
    expect(invitationIdFromRespondToken(SECRET, `${ID}.nope`)).toBeNull();
    expect(emailHash(SECRET, " Sara@Example.com")).toBe(emailHash(SECRET, "sara@example.com"));
    expect(maskEmail("sara@example.com")).toBe("sa••@example.com");
  });

  it("validate the admin's limits", () => {
    const ok = settingsUpdate({ sendingEnabled: "on", maxRecipientsPerSend: "10", maxRecipientsPerDay: "30", maxResends: "3", linkDays: "14" });
    expect(ok).toEqual({ ok: true, row: { sending_enabled: true, max_recipients_per_send: 10, max_recipients_per_day: 30, max_resends: 3, link_days: 14 } });
    expect(settingsUpdate({ maxRecipientsPerSend: "60", maxRecipientsPerDay: "30", maxResends: "3", linkDays: "14" }).ok).toBe(false);
    expect(settingsUpdate({ maxRecipientsPerSend: "40", maxRecipientsPerDay: "30", maxResends: "3", linkDays: "14" }).ok).toBe(false);
  });

  it("read a curated passage in the contributor's voice, with no monthly limit", async () => {
    const said: string[] = [];
    const { db, tables, storage } = fakeDb({ voice_invitation_settings: [settings()] });
    const first = await generatePreview(db, deps(said), "u1", "winnie-the-pooh-1");
    expect(said[0]).toMatch(/^Here is Edward Bear/);
    expect(storage[0]).toMatchObject({ bucket: "voice-previews", op: "upload" });
    await generatePreview(db, deps(said), "u1", "the-velveteen-rabbit-1");
    expect(tables.voice_previews!.find((p) => p.id === first.id)!.retired_at).toBeTruthy();
    for (const id of ["the-velveteen-rabbit-2", "winnie-the-pooh-2", "winnie-the-pooh-1", "the-velveteen-rabbit-1"]) await generatePreview(db, deps(said), "u1", id);
    expect(said).toHaveLength(6);
    const recent = new Date().toISOString();
    tables.voice_previews!.push(...Array.from({ length: PREVIEWS_PER_HOUR }, (_, i) => ({ id: `r${i}`, owner_id: "u2", created_at: recent, retired_at: recent })));
    await expect(generatePreview(db, deps(said), "u2", "winnie-the-pooh-1")).rejects.toMatchObject({ code: "generation_limit" });
    await expect(generatePreview(db, deps(said), "u1", "made-up")).rejects.toMatchObject({ code: "bad_passage" });
  });

  it("approve a draft, replacing the old preview and deleting its audio", async () => {
    const { db, tables, storage } = fakeDb({
      voice_previews: [
        { id: "old", owner_id: "u1", voice_version: 2, approved_at: "2026-10-01", retired_at: null, storage_key: "u1/old.mp3" },
        { id: "new", owner_id: "u1", voice_version: 2, approved_at: null, retired_at: null, storage_key: "u1/new.mp3", book_slug: "winnie-the-pooh", passage_id: "winnie-the-pooh-1" },
      ],
    });
    const p = await approvePreview(db, deps(), "u1", "new");
    expect(p.approved).toBe(true);
    expect(tables.voice_previews![0]!.retired_at).toBeTruthy();
    expect(storage).toEqual([{ bucket: "voice-previews", op: "remove", keys: ["u1/old.mp3"] }]);
    await expect(approvePreview(db, deps(), "u2", "new")).rejects.toMatchObject({ code: "no_preview" });
  });

  it("send invitations: hashed and encrypted addresses to the database, the real link only in the email", async () => {
    const mailer = new MemoryMailer();
    const { db, tables, calls } = fakeDb(
      {
        voice_invitation_settings: [settings()],
        voice_previews: [{ id: "p1", owner_id: "u1", voice_version: 2, approved_at: "2026-10-01", retired_at: null, book_slug: "winnie-the-pooh", passage_id: "winnie-the-pooh-1", created_at: "2026-10-01" }],
        adult_profiles: [{ user_id: "u1", display_name: "June Walker" }],
      },
      (_name, args) => {
        const recipients = args.p_recipients as Row[];
        const out = recipients.map((r, i) => ({ email_hash: r.email_hash, result: i === 0 ? "created" : "suppressed", ...(i === 0 ? { id: ID } : {}) }));
        tables.voice_invitation_sends = [{ id: 7, invitation_id: ID, delivery: "queued" }];
        return out;
      },
    );
    const ctx = { secret: SECRET, origin: "https://readli.ai", mailer };
    const input = { recipients: [{ name: "Sara", email: "Sara@example.com" }, { email: "ted@example.org" }], message: "Love, Mom", adultsConfirmed: true, shareConsent: true };
    const out = await sendInvitations(db, ctx, deps(), { id: "u1", name: "June" }, input);
    expect(out.map((o) => o.result)).toEqual(["created", "suppressed"]);
    const args = calls[0]!.args;
    expect(JSON.stringify(args)).not.toContain("example.com");
    expect((args.p_recipients as Row[])[0]!.email_hash).toBe(emailHash(SECRET, "sara@example.com"));
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe("sara@example.com");
    expect(mailer.sent[0]!.subject).toBe("June Walker has a bedtime story for your family");
    expect(mailer.sent[0]!.text).toContain("Love, Mom");
    expect(mailer.sent[0]!.text).toContain("Hear June Walker's voice reading Winnie-the-Pooh.");
    expect(mailer.sent[0]!.html).toContain('src="https://readli.ai/email-covers/winnie-the-pooh.jpg"');
    const token = /readli\.ai\/v\/([A-Za-z0-9_-]+)/.exec(mailer.sent[0]!.text)![1]!;
    expect((args.p_recipients as Row[])[0]!.token_hash).toBe(hashInvitationToken(token));
    expect(tables.voice_invitation_sends![0]).toMatchObject({ delivery: "sent", provider_message_id: "mem_1" });
    expect(tables.consent_receipts![0]).toMatchObject({ purpose: "voice_invitation", user_id: "u1" });
    expect(tables.analytics_events!.map((e) => e.name)).toEqual(["invite_sent"]);
    expect(JSON.stringify(tables.analytics_events)).not.toContain("@");

    await expect(sendInvitations(db, ctx, deps(), { id: "u1", name: "June" }, { ...input, adultsConfirmed: false })).rejects.toMatchObject({ code: "adults_only" });
    await expect(sendInvitations(db, { ...ctx, mailer: null }, deps(), { id: "u1", name: "June" }, input)).rejects.toMatchObject({ code: "sending_off" });
    tables.voice_invitation_settings![0]!.sending_enabled = false;
    await expect(sendInvitations(db, ctx, deps(), { id: "u1", name: "June" }, input)).rejects.toMatchObject({ code: "sending_off" });
  });

  it("decline blocks one contributor; unsubscribe and report block every invitation to the address", async () => {
    const inv = { id: ID, contributor_id: "u1", recipient_email_hash: "h", accepted_at: null, declined_at: null, reported_at: null };
    const { db, tables } = fakeDb({ voice_invitations: [{ ...inv }] });
    const tok = respondToken(SECRET, ID);
    expect(await respond(db, SECRET, "bad.token", "decline")).toBe(false);
    expect(await respond(db, SECRET, tok, "decline")).toBe(true);
    expect(tables.email_suppressions![0]).toMatchObject({ email_hash: "h", contributor_id: "u1", reason: "declined" });
    await respond(db, SECRET, tok, "report", { reason: "dont_know", details: "Who is this?" });
    expect(tables.email_suppressions![1]).toMatchObject({ contributor_id: null, reason: "reported" });
    expect(tables.voice_invitation_reports![0]).toMatchObject({ reason: "dont_know", details: "Who is this?" });
    expect(tables.voice_invitations![0]!.reported_at).toBeTruthy();
  });

  it("leave connecting a storyteller to the database, which never activates a slot or approves a child", async () => {
    const { db, calls } = fakeDb({}, () => "not_guardian");
    expect(await acceptInvitation(db, "tok", "u2", "h1")).toBe("not_guardian");
    expect(calls).toEqual([{ name: "accept_voice_invitation", args: { p_token_hash: hashInvitationToken("tok"), p_user: "u2", p_household: "h1" } }]);
  });

  it("send without a preview, in the contributor's words or Readli's default", async () => {
    const mailer = new MemoryMailer();
    const { db, tables, calls } = fakeDb({ voice_invitation_settings: [settings()], adult_profiles: [{ user_id: "u1", display_name: "Andrea" }] }, (_name, args) => {
      tables.voice_invitation_sends = [{ id: 1, invitation_id: ID, delivery: "queued" }];
      return (args.p_recipients as Row[]).map((r) => ({ email_hash: r.email_hash, result: "created", id: ID }));
    });
    const input = { recipients: [{ email: "kevin@example.com" }], message: "", adultsConfirmed: true, shareConsent: true };
    expect((await sendInvitations(db, { secret: SECRET, origin: "https://readli.ai", mailer }, deps(), { id: "u1", name: "Andrea" }, input))[0]!.result).toBe("created");
    expect(calls[0]!.args.p_preview).toBeNull();
    const text = mailer.sent[0]!.text;
    expect(text).toContain("I made my Readli voice so I can read bedtime stories to the kids. I hope you love it!");
    expect(text).toContain("Hear Andrea read a story: https://readli.ai/v/");
    expect(text).not.toContain("voice reading");
    expect(mailer.sent[0]!.html).not.toContain("email-covers/winnie");
  });

  it("tell the contributor once when a family connects their voice", async () => {
    const mailer = new MemoryMailer();
    const tok = "connect-token-abcdefghijklmnop";
    const { db, tables } = fakeDb(
      {
        voice_invitations: [{ id: ID, contributor_id: "u1", token_hash: hashInvitationToken(tok), accepted_at: null }],
        adult_profiles: [{ user_id: "u1", display_name: "Andrea" }],
        households: [{ id: "h1", name: "The Godfrey family" }],
      },
      () => "accepted",
    );
    (db as unknown as { auth: { admin: { getUserById: () => Promise<unknown> } } }).auth.admin.getUserById = async () => ({ data: { user: { email: "andrea@example.com" } }, error: null });
    expect(await acceptInvitation(db, tok, "kevin", "h1", { mailer, origin: "https://readli.ai" })).toBe("accepted");
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ to: "andrea@example.com", subject: "The Godfrey family connected your Readli voice" });
    expect(mailer.sent[0]!.text).toContain("https://readli.ai/voice");
    tables.voice_invitations![0]!.accepted_at = "2026-10-21";
    await acceptInvitation(db, tok, "kevin", "h1", { mailer, origin: "https://readli.ai" });
    expect(mailer.sent).toHaveLength(1);
  });

  it("play the giver's approved preview on their gift's page, and nothing for a cancelled gift", async () => {
    const code = "ABCD-EFGH-JKMN";
    const { db, tables } = fakeDb({
      gifts: [{ id: "g1", giver_id: "u1", status: "sent", code_hash: hashGiftCode(code) }],
      voice_profiles: [{ id: "v1", owner_id: "u1", status: "ready", version: 2 }],
      voice_previews: [{ id: "p1", owner_id: "u1", voice_version: 2, approved_at: "2026-10-01", retired_at: null, book_slug: "winnie-the-pooh", storage_key: "u1/p1.mp3" }],
      adult_profiles: [{ user_id: "u1", display_name: "June" }],
    });
    expect(await giftPreview(db, code)).toEqual({ giverName: "June", book: { title: "Winnie-the-Pooh", coverUrl: expect.any(String) } });
    expect(await playGiftPreview(db, code)).toBe("https://signed/u1/p1.mp3");
    expect(tables.analytics_events!.map((e) => e.name)).toEqual(["gift_preview_played"]);
    tables.gifts![0]!.status = "cancelled";
    expect(await playGiftPreview(db, code)).toBeNull();
    expect(await giftPreview(db, "nonsense")).toBeNull();
  });

  it("never plays the issuing admin's voice on a complimentary membership", async () => {
    const code = "ABCD-EFGH-JKMN";
    const { db, tables } = fakeDb({
      gifts: [{ id: "g1", giver_id: "admin", status: "sent", code_hash: hashGiftCode(code), complimentary_for: "fundraiser" }],
      voice_profiles: [{ id: "v1", owner_id: "admin", status: "ready", version: 2 }],
      voice_previews: [{ id: "p1", owner_id: "admin", voice_version: 2, approved_at: "2026-10-01", retired_at: null, book_slug: "winnie-the-pooh", storage_key: "admin/p1.mp3" }],
      adult_profiles: [{ user_id: "admin", display_name: "Daddy" }],
    });
    expect(await giftPreview(db, code)).toBeNull();
    expect(await playGiftPreview(db, code)).toBeNull();
    expect(tables.analytics_events ?? []).toEqual([]);
  });
});

describe("invitation funnel events", () => {
  const live = (over: Row = {}) => ({ id: "inv-1", contributor_id: "june", token_hash: hashInvitationToken("tok-live"), expires_at: "2099-01-01T00:00:00Z", accepted_at: null, declined_at: null, revoked_at: null, ...over });

  it("notes a listen to the end and each path chosen, only for a usable invitation", async () => {
    const { db, tables } = fakeDb({ voice_invitations: [live()], analytics_events: [] });
    expect(await recipientEvent(db, "tok-live", "audio_completed")).toBe(true);
    expect(await recipientEvent(db, "tok-live", "connect_cta")).toBe(true);
    expect(await recipientEvent(db, "tok-live", "made_up")).toBe(false);
    expect(await recipientEvent(db, "wrong", "family_cta")).toBe(false);
    expect(tables.analytics_events!.map((e) => e.name)).toEqual(["invite_audio_completed", "invite_connect_cta_clicked"]);
    expect(tables.analytics_events![0]!.properties).toEqual({ invitation_id: "inv-1", contributor_id: "june" });

    const expired = fakeDb({ voice_invitations: [live({ expires_at: "2020-01-01T00:00:00Z" })], analytics_events: [] });
    expect(await recipientEvent(expired.db, "tok-live", "audio_completed")).toBe(false);
  });

  it("notes the first story played once per family's invitation, with nothing about the child", async () => {
    const { db, tables } = fakeDb({
      voice_invitations: [live({ household_id: "A", accepted_at: "2026-10-20T00:00:00Z" }), live({ id: "inv-2", household_id: "B", accepted_at: null, token_hash: "x" })],
      analytics_events: [],
    });
    await noteInvitedStoryPlayed(db, "june", "A");
    await noteInvitedStoryPlayed(db, "june", "A");
    // Household B never accepted, so a play there credits nothing.
    await noteInvitedStoryPlayed(db, "june", "B");
    expect(tables.analytics_events).toHaveLength(1);
    expect(tables.analytics_events![0]).toMatchObject({ name: "invite_first_story_played", properties: { invitation_id: "inv-1", contributor_id: "june", household_id: "A" } });
  });
});
