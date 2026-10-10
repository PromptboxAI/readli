import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AccountFamilyStore } from "@/lib/family/account-store";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { createChildProfile, createHousehold, grantEntitlement, setFavorite } from "@/lib/family/service";
import { decodeKidsProfile, encodeKidsProfile } from "@/lib/family/session";
import { displayName, safeNext } from "./supabase";

type Row = Record<string, unknown>;

/** Just enough of the Supabase query builder to check what the account store saves. */
function fakeDb(tables: Record<string, Row[]> = {}) {
  const t = (name: string) => (tables[name] ??= []);
  const builder = (name: string) => {
    let filters: [string, unknown, "eq" | "in"][] = [];
    let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "delete" } = { kind: "select" };
    const match = (r: Row) => filters.every(([k, v, how]) => (how === "eq" ? r[k] === v : (v as unknown[]).includes(r[k])));
    const run = () => {
      if (op.kind === "update") for (const r of t(name).filter(match)) Object.assign(r, op.values);
      if (op.kind === "delete") tables[name] = t(name).filter((r) => !match(r));
      return { data: op.kind === "select" ? t(name).filter(match).map((r) => ({ ...r })) : null, error: null };
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => ((filters = [...filters, [k, v, "eq"]]), q),
      in: (k: string, v: unknown[]) => ((filters = [...filters, [k, v, "in"]]), q),
      update: (values: Row) => ((op = { kind: "update", values }), q),
      delete: () => ((op = { kind: "delete" }), q),
      insert: (rows: Row | Row[]) => {
        for (const r of [rows].flat()) t(name).push({ removed_at: null, deleted_at: null, ...r });
        return Promise.resolve({ data: null, error: null });
      },
      upsert: (rows: Row | Row[], opts: { onConflict: string; ignoreDuplicates?: boolean }) => {
        const keys = opts.onConflict.split(",");
        for (const r of [rows].flat()) {
          const old = t(name).find((x) => keys.every((k) => x[k] === r[k]));
          if (old && !opts.ignoreDuplicates) Object.assign(old, r);
          if (!old) t(name).push({ removed_at: null, ...r });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  return { db: { from: builder } as unknown as SupabaseClient, tables };
}

const ME = { id: "11111111-1111-4111-8111-111111111111", name: "Sara" };
const ADULT = { kind: "adult" as const, adultId: ME.id };

describe("real family accounts", () => {
  it("saves a new family, its plan, a kids profile and a favourite, and reads them back", async () => {
    const { db, tables } = fakeDb();
    const store = new AccountFamilyStore(db, ME, DEFAULT_PLAN);
    const home = await createHousehold(store, ADULT, "The Rivera family");
    expect(tables.adult_profiles).toEqual([{ removed_at: null, user_id: ME.id, display_name: "Sara" }]);
    expect(tables.households).toMatchObject([{ id: home, name: "The Rivera family", created_by: ME.id }]);
    expect(tables.household_members).toMatchObject([{ household_id: home, user_id: ME.id, role: "guardian" }]);

    await expect(createChildProfile(store, ADULT, home, "Maya")).rejects.toMatchObject({ code: "no_family_plan" });
    await grantEntitlement(store, home, { source: "gift", months: 12 });
    const maya = await createChildProfile(store, ADULT, home, "Maya");
    expect(tables.child_profiles).toMatchObject([{ id: maya, household_id: home, nickname: "Maya" }]);
    expect(tables.child_guardians).toMatchObject([{ child_id: maya, user_id: ME.id, removed_at: null }]);
    await setFavorite(store, { kind: "child", childId: maya }, maya, "peter-rabbit", true);
    expect(tables.child_favorites).toMatchObject([{ child_id: maya, book_slug: "peter-rabbit" }]);

    const again = await new AccountFamilyStore(db, ME, DEFAULT_PLAN).read();
    expect(again.households).toEqual([{ id: home, name: "The Rivera family" }]);
    expect(again.children.map((c) => [c.nickname, c.guardianIds])).toEqual([["Maya", [ME.id]]]);
    expect(again.favorites).toEqual([{ childId: maya, bookSlug: "peter-rabbit" }]);
    expect(again.entitlements).toHaveLength(1);
  });

  it("a second family request returns the grown-up's existing family", async () => {
    const { db, tables } = fakeDb();
    const store = new AccountFamilyStore(db, ME, DEFAULT_PLAN);
    const first = await createHousehold(store, ADULT, "Ours");
    expect(await createHousehold(store, ADULT, "Another")).toBe(first);
    expect(tables.households).toHaveLength(1);
  });

  it("another grown-up sees none of this family", async () => {
    const { db } = fakeDb();
    await createHousehold(new AccountFamilyStore(db, ME, DEFAULT_PLAN), ADULT, "Ours");
    const other = await new AccountFamilyStore(db, { id: "22222222-2222-4222-8222-222222222222", name: "Stranger" }, DEFAULT_PLAN).read();
    expect(other.households).toEqual([]);
    expect(other.members).toEqual([]);
  });

  it("a kids profile cookie only works for the grown-up who opened it", () => {
    const value = encodeKidsProfile(ME.id, "kid-1", "k");
    expect(decodeKidsProfile(value, ME.id, "k")).toBe("kid-1");
    expect(decodeKidsProfile(value, "someone-else", "k")).toBeNull();
    expect(decodeKidsProfile(value.replace("kid-1", "kid-2"), ME.id, "k")).toBeNull();
  });

  it("sign-in only continues to same-site pages", () => {
    expect(safeNext("/family/books")).toBe("/family/books");
    expect(safeNext("https://evil.example")).toBe("/family");
    expect(safeNext("//evil.example")).toBe("/family");
    expect(safeNext("/\\evil.example")).toBe("/family");
    expect(safeNext(null)).toBe("/family");
  });

  it("names a new grown-up from Google, their sign-up name or their email", () => {
    expect(displayName({ email: "sara@example.com", user_metadata: { full_name: "Sara Rivera" } })).toBe("Sara Rivera");
    expect(displayName({ email: "sara@example.com", user_metadata: {} })).toBe("sara");
  });
});
