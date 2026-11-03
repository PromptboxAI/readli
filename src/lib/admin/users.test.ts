import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isPaused } from "@/lib/auth/supabase";
import { AdminActionError } from "./tester-plans";
import { adminDeleteAccount, filterAccounts, listAccounts, PAUSE_DURATION, setAccountPaused, type AdminAccount } from "./users";

const env = { NODE_ENV: "production", ADMIN_EMAILS: "boss@readli.ai" } as NodeJS.ProcessEnv;
const admin = { id: "boss", email: "boss@readli.ai", name: "Boss" };
const confirmed = "2026-10-01T00:00:00Z";
const users = [
  { id: "boss", email: "boss@readli.ai", email_confirmed_at: confirmed, created_at: "2026-09-01T00:00:00Z", user_metadata: {} },
  { id: "t1", email: "Tester@Example.com", email_confirmed_at: confirmed, created_at: "2026-11-01T00:00:00Z", user_metadata: { full_name: "Test Person" } },
  { id: "t2", email: "paused@example.com", email_confirmed_at: null, created_at: "2026-10-15T00:00:00Z", banned_until: "2999-01-01T00:00:00Z", user_metadata: {} },
];

function fakeDb() {
  const updates: [string, Record<string, unknown>][] = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    household_members: [{ user_id: "t1", household_id: "h1", removed_at: null }],
    households: [{ id: "h1", name: "The Godfrey Family" }],
    household_entitlements: [{ id: "e1", household_id: "h1", source: "donated", status: "active", starts_at: "2026-01-01T00:00:00Z", ends_at: "2999-01-01T00:00:00Z" }],
  };
  const from = (table: string) => {
    const b = { select: () => b, is: () => b, in: () => b, eq: () => b, then: (r: (v: unknown) => unknown) => r({ data: tables[table] ?? [], error: null }) };
    return b;
  };
  const db = {
    from,
    auth: {
      admin: {
        listUsers: async () => ({ data: { users }, error: null }),
        getUserById: async (id: string) => ({ data: { user: users.find((u) => u.id === id) ?? null }, error: null }),
        updateUserById: async (id: string, attrs: Record<string, unknown>) => {
          updates.push([id, attrs]);
          return { data: {}, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;
  return { db, updates };
}

describe("admin accounts", () => {
  it("lists every account newest first, with families, admins and pauses", async () => {
    const list = await listAccounts(fakeDb().db, env);
    expect(list.map((a) => a.id)).toEqual(["t1", "t2", "boss"]);
    expect(list[0]).toMatchObject({ name: "Test Person", families: ["The Godfrey Family"], paused: false, isAdmin: false });
    expect(list[0]?.homes).toEqual([{ name: "The Godfrey Family", plan: expect.objectContaining({ source: "donated" }) }]);
    expect(list[1]).toMatchObject({ paused: true, confirmed: false });
    expect(list[2]?.isAdmin).toBe(true);
  });

  it("finds accounts by email, name or family", () => {
    const a = (over: Partial<AdminAccount>): AdminAccount => ({
      id: "x", email: null, name: null, createdAt: confirmed, lastSignInAt: null, confirmed: true, isAdmin: false, paused: false, families: [], homes: [], ...over,
    });
    const list = [a({ id: "1", email: "liadjusters@gmail.com" }), a({ id: "2", name: "Andrea" }), a({ id: "3", families: ["The Godfreys"] })];
    expect(filterAccounts(list, " LIADJ").map((x) => x.id)).toEqual(["1"]);
    expect(filterAccounts(list, "andrea").map((x) => x.id)).toEqual(["2"]);
    expect(filterAccounts(list, "godfrey").map((x) => x.id)).toEqual(["3"]);
    expect(filterAccounts(list, "")).toHaveLength(3);
  });

  it("pauses and unpauses through Supabase's sign-in ban", async () => {
    const { db, updates } = fakeDb();
    await setAccountPaused(db, admin, "t1", true, env);
    await setAccountPaused(db, admin, "t2", false, env);
    expect(updates).toEqual([["t1", { ban_duration: PAUSE_DURATION }], ["t2", { ban_duration: "none" }]]);
  });

  it("treats a ban in the future as paused", () => {
    const at = new Date("2026-11-03T00:00:00Z");
    expect(isPaused({ banned_until: "2026-11-04T00:00:00Z" }, at)).toBe(true);
    expect(isPaused({ banned_until: "2026-11-02T00:00:00Z" }, at)).toBe(false);
    expect(isPaused({}, at)).toBe(false);
  });

  it("never pauses or deletes an admin, or an account that doesn't exist", async () => {
    const { db, updates } = fakeDb();
    await expect(setAccountPaused(db, admin, "boss", true, env)).rejects.toThrow(AdminActionError);
    await expect(setAccountPaused(db, admin, "nobody", true, env)).rejects.toThrow(AdminActionError);
    await expect(adminDeleteAccount({ db, provider: null, refs: null }, admin, "boss", "boss@readli.ai", env)).rejects.toThrow(AdminActionError);
    expect(updates).toEqual([]);
  });

  it("deletes only when the typed email matches", async () => {
    const { db } = fakeDb();
    await expect(adminDeleteAccount({ db, provider: null, refs: null }, admin, "t1", "someone@else.com", env)).rejects.toThrow("Type the account's email");
    await expect(adminDeleteAccount({ db, provider: null, refs: null }, admin, "t1", "", env)).rejects.toThrow(AdminActionError);
  });
});
