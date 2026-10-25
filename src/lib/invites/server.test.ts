import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { acceptInviteToken, createInvite, hashInviteToken, inviteForToken, inviteLink, InviteError, listInvites, revokeInvite, setInviteRelationship, statusOf } from "./server";

type Row = Record<string, unknown>;

/** Enough of the Supabase query builder for the invitation queries. */
function fakeDb(tables: Record<string, Row[]> = {}, rpc?: (name: string, args: Row) => { data: unknown; error: { message: string } | null }) {
  const t = (name: string) => (tables[name] ??= []);
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; values: Row } = { kind: "select" };
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      insert: (rows: Row | Row[]) => ((op = { kind: "insert", rows: [rows].flat() }), q),
      update: (values: Row) => ((op = { kind: "update", values }), q),
      then: (resolve: (v: unknown) => void) => {
        if (op.kind === "insert") {
          const made = op.rows.map((r, i) => ({ id: `inv-${t(name).length + i}`, accepted_at: null, revoked_at: null, created_at: "2026-10-11T00:00:00.000Z", ...r }));
          t(name).push(...made);
          return resolve({ data: made, error: null });
        }
        const hits = t(name).filter((r) => filters.every((f) => f(r)));
        if (op.kind === "update") for (const r of hits) Object.assign(r, op.values);
        resolve({ data: hits.map((r) => ({ ...r })), error: null });
      },
    };
    return q;
  };
  return { db: { from, rpc: async (n: string, a: Row) => rpc!(n, a) } as unknown as SupabaseClient, tables };
}

const NOW = new Date("2026-10-11T12:00:00Z");

describe("family invitations for real accounts", () => {
  it("store only a hash of the link token and expire after 14 days", async () => {
    const { db, tables } = fakeDb();
    const { invite, token } = await createInvite(db, { householdId: "h1", inviterId: "u1", name: " Grandma June ", relationship: "Grandma" }, NOW);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(tables.household_invitations![0]).toMatchObject({ token_hash: hashInviteToken(token), invitee_name: "Grandma June", relationship_label: "Grandma", expires_at: "2026-10-25T12:00:00.000Z" });
    expect(JSON.stringify(tables)).not.toContain(token);
    expect(invite).toMatchObject({ name: "Grandma June", status: "invited", email: null });
    expect(inviteLink("https://readli.ai/", token)).toBe(`https://readli.ai/voice/join?invite=${token}`);
  });

  it("need a name, and keep the family's own words for them, cleaned and short", async () => {
    const { db, tables } = fakeDb();
    await expect(createInvite(db, { householdId: "h1", inviterId: "u1", name: "  ", relationship: "Grandma" })).rejects.toBeInstanceOf(InviteError);
    await createInvite(db, { householdId: "h1", inviterId: "u1", name: "Pat", relationship: "  Nanny   Pat " });
    await createInvite(db, { householdId: "h1", inviterId: "u1", name: "Lou", relationship: "<script>" });
    await createInvite(db, { householdId: "h1", inviterId: "u1", name: "Ali", relationship: "" });
    await createInvite(db, { householdId: "h1", inviterId: "u1", name: "Max", relationship: "x".repeat(60) });
    expect(tables.household_invitations!.map((r) => r.relationship_label)).toEqual(["Nanny Pat", "script", null, "x".repeat(40)]);
  });

  it("let the family change an invited person's label until they accept, and only in their own family", async () => {
    const { db, tables } = fakeDb({
      household_invitations: [
        { id: "a", household_id: "h1", invitee_name: "June", relationship_label: "Grandma", expires_at: "2026-10-20T00:00:00Z", accepted_at: null, revoked_at: null },
        { id: "b", household_id: "h1", invitee_name: "Lou", relationship_label: null, expires_at: "2026-10-20T00:00:00Z", accepted_at: "2026-10-12T00:00:00Z", revoked_at: null },
      ],
    });
    await expect(setInviteRelationship(db, "h2", "a", "Mom")).rejects.toMatchObject({ status: 404 });
    await expect(setInviteRelationship(db, "h1", "b", "Grandpa")).rejects.toMatchObject({ status: 404 });
    expect(await setInviteRelationship(db, "h1", "a", " Caregiver ")).toMatchObject({ id: "a", relationship: "Caregiver" });
    expect(tables.household_invitations![0]!.relationship_label).toBe("Caregiver");
    expect(await setInviteRelationship(db, "h1", "a", "")).toMatchObject({ relationship: "" });
    expect(tables.household_invitations![0]!.relationship_label).toBeNull();
    expect(tables.household_invitations![1]!.relationship_label).toBeNull();
  });

  it("take an email instead of a name, keep only its hash, and refuse a bad address", async () => {
    const { db, tables } = fakeDb();
    const { invite } = await createInvite(db, { householdId: "h1", inviterId: "u1", name: "", relationship: "", email: "andrea@example.com", emailHash: "hashed" });
    expect(invite.name).toBe("andrea");
    expect(tables.household_invitations![0]).toMatchObject({ invitee_name: "andrea", recipient_email_hash: "hashed" });
    expect(JSON.stringify(tables)).not.toContain("andrea@example.com");
    await createInvite(db, { householdId: "h1", inviterId: "u1", name: "Mommy", relationship: "Mom", email: "andrea@example.com", emailHash: "hashed" });
    expect(tables.household_invitations![1]).toMatchObject({ invitee_name: "Mommy", relationship_label: "Mom" });
    await expect(createInvite(db, { householdId: "h1", inviterId: "u1", name: "Mommy", relationship: "", email: "not-an-email" })).rejects.toMatchObject({ code: "bad_email" });
  });

  it("show each status, and only the family's own invitations", async () => {
    const base = { expires_at: "2026-10-20T00:00:00Z", accepted_at: null, revoked_at: null };
    expect(statusOf(base, NOW)).toBe("invited");
    expect(statusOf({ ...base, accepted_at: "x" }, NOW)).toBe("joined_no_voice");
    expect(statusOf({ ...base, revoked_at: "x" }, NOW)).toBe("withdrawn");
    expect(statusOf({ ...base, expires_at: "2026-10-01T00:00:00Z" }, NOW)).toBe("expired");
    expect(statusOf({ ...base, declined_at: "x" }, NOW)).toBe("declined");
    const { db } = fakeDb({ household_invitations: [{ id: "a", household_id: "h1", invitee_name: "A", created_at: "2026-10-10T00:00:00Z", ...base }, { id: "b", household_id: "h2", invitee_name: "B", created_at: "2026-10-10T00:00:00Z", ...base }] });
    expect((await listInvites(db, "h1")).map((i) => i.id)).toEqual(["a"]);
  });

  it("can be withdrawn only by their family and only before they're accepted", async () => {
    const rows = [
      { id: "a", household_id: "h1", accepted_at: null, revoked_at: null },
      { id: "b", household_id: "h1", accepted_at: "x", revoked_at: null },
    ];
    const { db, tables } = fakeDb({ household_invitations: rows });
    await expect(revokeInvite(db, "h2", "a", NOW)).rejects.toMatchObject({ status: 404 });
    await expect(revokeInvite(db, "h1", "b", NOW)).rejects.toMatchObject({ status: 404 });
    await revokeInvite(db, "h1", "a", NOW);
    expect(tables.household_invitations![0]!.revoked_at).toBe(NOW.toISOString());
  });

  it("show the invitee only the family name and who invited them", async () => {
    const { db } = fakeDb({
      household_invitations: [{ token_hash: hashInviteToken("tok"), household_id: "h1", inviter_id: "u1", invitee_name: "June", expires_at: "2026-10-20T00:00:00Z", accepted_at: null, revoked_at: null }],
      households: [{ id: "h1", name: "The Riveras" }],
      adult_profiles: [{ user_id: "u1", display_name: "Sara" }],
      household_members: [{ household_id: "h1", user_id: "u1", removed_at: null }],
    });
    expect(await inviteForToken(db, "tok", "u2", NOW)).toEqual({ familyName: "The Riveras", inviterName: "Sara", inviteeName: "June", status: "invited", alreadyMember: false, householdId: null });
    expect(await inviteForToken(db, "tok", "u1", NOW)).toMatchObject({ alreadyMember: true, householdId: "h1" });
    expect(await inviteForToken(db, "nope", null, NOW)).toBeNull();
  });

  it("accept through the database function and explain why one can't be used", async () => {
    const calls: Row[] = [];
    const answers = [
      { data: "h1", error: null },
      { data: null, error: { message: "already a member of this family" } },
      { data: null, error: { message: "invitation is not valid" } },
    ];
    const { db } = fakeDb({}, (name, args) => (calls.push({ name, ...args }), answers.shift()!));
    expect(await acceptInviteToken(db, "tok", "u2")).toBe("h1");
    expect(calls[0]).toEqual({ name: "accept_household_invitation", p_token_hash: hashInviteToken("tok"), p_user: "u2" });
    await expect(acceptInviteToken(db, "tok", "u2")).rejects.toMatchObject({ status: 409, code: "already_member" });
    await expect(acceptInviteToken(db, "tok", "u2")).rejects.toMatchObject({ status: 410, code: "invite_invalid" });
  });
});
