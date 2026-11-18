import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isPaused } from "@/lib/auth/supabase";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { AdminActionError } from "./tester-plans";
import { adminDeleteAccount, filterAccounts, grantCredits, wholeNumber, listAccounts, matchesFilter, PAUSE_DURATION, setAccountPaused, sortAccounts, type AdminAccount } from "./users";

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
    expect(list[0]?.homes).toEqual([{ id: "h1", name: "The Godfrey Family", plan: expect.objectContaining({ source: "donated" }) }]);
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

describe("account table filters and sorting", () => {
  const a = (over: Partial<AdminAccount>): AdminAccount => ({
    id: "x", email: null, name: null, createdAt: confirmed, lastSignInAt: null, confirmed: true, isAdmin: false, paused: false, families: [], homes: [], ...over,
  });
  const plan = (source: string) => ({ id: "e", source, startsAt: confirmed, endsAt: null }) as unknown as NonNullable<AdminAccount["homes"][number]["plan"]>;
  const list = [
    a({ id: "paid", email: "b@x.com", createdAt: "2026-10-01T00:00:00Z", lastSignInAt: "2026-11-01T00:00:00Z", families: ["Zed"], homes: [{ id: "zed", name: "Zed", plan: plan("subscription") }] }),
    a({ id: "comp", email: "a@x.com", createdAt: "2026-11-02T00:00:00Z", families: ["Amber"], homes: [{ id: "amber", name: "Amber", plan: plan("donated") }] }),
    a({ id: "none", email: "c@x.com", createdAt: "2026-10-15T00:00:00Z", lastSignInAt: "2026-11-03T00:00:00Z", paused: true, confirmed: false }),
    a({ id: "empty", email: "d@x.com", createdAt: "2026-09-01T00:00:00Z", families: ["Moss"], homes: [{ id: "moss", name: "Moss", plan: null }] }),
  ];
  const ids = (xs: AdminAccount[]) => xs.map((x) => x.id);

  it("filters by plan, family, pause and confirmation", () => {
    expect(ids(list.filter((x) => matchesFilter(x, "paid")))).toEqual(["paid"]);
    expect(ids(list.filter((x) => matchesFilter(x, "complimentary")))).toEqual(["comp"]);
    expect(ids(list.filter((x) => matchesFilter(x, "no_plan")))).toEqual(["empty"]);
    expect(ids(list.filter((x) => matchesFilter(x, "no_family")))).toEqual(["none"]);
    expect(ids(list.filter((x) => matchesFilter(x, "paused")))).toEqual(["none"]);
    expect(ids(list.filter((x) => matchesFilter(x, "unconfirmed")))).toEqual(["none"]);
    expect(list.filter((x) => matchesFilter(x, null))).toHaveLength(4);
  });

  it("sorts by joined, last sign-in, email and family", () => {
    expect(ids(sortAccounts(list, "joined"))).toEqual(["comp", "none", "paid", "empty"]);
    expect(ids(sortAccounts(list, "last_sign_in"))).toEqual(["none", "paid", "comp", "empty"]);
    expect(ids(sortAccounts(list, "email"))).toEqual(["comp", "paid", "none", "empty"]);
    expect(ids(sortAccounts(list, "family"))).toEqual(["comp", "empty", "paid", "none"]);
  });
});

describe("granting credits", () => {
  function grantDb(member: boolean) {
    const inserts: Record<string, unknown>[] = [];
    const rowsFor: Record<string, unknown> = { household_members: member ? { household_id: "h1" } : null, households: { name: "The Godfrey Family" } };
    const db = {
      from: (table: string) => {
        const b = {
          select: () => b, eq: () => b, is: () => b,
          maybeSingle: async () => ({ data: rowsFor[table] ?? null, error: null }),
          insert: async (row: Record<string, unknown>) => {
            inserts.push({ table, ...row });
            return { error: null };
          },
        };
        return b;
      },
      auth: { admin: { getUserById: async (id: string) => ({ data: { user: users.find((u) => u.id === id) ?? null }, error: null }) } },
    } as unknown as SupabaseClient;
    return { db, inserts };
  }
  const now = new Date("2026-11-08T00:00:00Z");
  const grant = { userId: "t1", householdId: "h1", credits: 50, expiresInDays: 0, note: "" };

  it("adds a promotional lot in characters that never expires, recording the admin", async () => {
    const { db, inserts } = grantDb(true);
    await expect(grantCredits(db, admin, grant, DEFAULT_PLAN, now)).resolves.toEqual({ email: "Tester@Example.com", family: "The Godfrey Family" });
    expect(inserts).toEqual([
      expect.objectContaining({
        table: "narration_credit_lots", household_id: "h1", source: "promotional", credits: 50 * DEFAULT_PLAN.charactersPerCredit,
        expires_at: null, granted_by: "boss", note: "Credits from Readli (50)",
      }),
    ]);
  });

  it("lets an admin grant to their own account, with an expiry and a note", async () => {
    const { db, inserts } = grantDb(true);
    await grantCredits(db, admin, { ...grant, userId: "boss", expiresInDays: 30, note: " Testing " }, DEFAULT_PLAN, now);
    expect(inserts[0]).toMatchObject({ expires_at: "2026-12-08T00:00:00.000Z", note: "Testing" });
  });

  it("refuses bad amounts and families the account isn't in", async () => {
    const { db, inserts } = grantDb(false);
    await expect(grantCredits(db, admin, grant, DEFAULT_PLAN, now)).rejects.toBeInstanceOf(AdminActionError);
    const ok = grantDb(true).db;
    for (const credits of [0, -5, 1.5, Number.NaN, 10001]) {
      await expect(grantCredits(ok, admin, { ...grant, credits }, DEFAULT_PLAN, now)).rejects.toBeInstanceOf(AdminActionError);
    }
    await expect(grantCredits(ok, admin, { ...grant, expiresInDays: Number.NaN }, DEFAULT_PLAN, now)).rejects.toBeInstanceOf(AdminActionError);
    expect(inserts).toEqual([]);
  });

  it("reads whole numbers from the form", () => {
    expect(wholeNumber(" 25 ")).toBe(25);
    expect(Number.isNaN(wholeNumber("2.5"))).toBe(true);
    expect(Number.isNaN(wholeNumber("-1"))).toBe(true);
  });
});
