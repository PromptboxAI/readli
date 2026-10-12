import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { normalizeGiftCode } from "@/lib/gifting/codes";
import { hashGiftCode } from "@/lib/gifting/codes.server";
import { giftLink, issueComplimentary } from "./complimentary";
import { AdminActionError } from "./tester-plans";

type Row = Record<string, unknown>;

function fakeDb() {
  const tables: Record<string, Row[]> = {};
  const db = {
    from: (name: string) => ({
      insert: async (rows: Row | Row[]) => {
        (tables[name] ??= []).push(...[rows].flat());
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, tables };
}

const admin = { id: "a1", email: "admin@readli.ai", name: "Admin" };

describe("complimentary memberships", () => {
  it("issue free annual gift codes, store only their hashes and log the action", async () => {
    const { db, tables } = fakeDb();
    const at = new Date("2026-10-11T12:00:00Z");
    const codes = await issueComplimentary(db, admin, { organization: " Oak Street Elementary ", kind: "school", count: 3 }, at);
    expect(codes).toHaveLength(3);
    expect(new Set(codes).size).toBe(3);
    for (const c of codes) expect(normalizeGiftCode(c)).toBe(c);
    expect(tables.gifts!.map((g) => g.code_hash)).toEqual(codes.map(hashGiftCode));
    expect(JSON.stringify(tables)).not.toContain(codes[0]);
    expect(tables.gifts![0]).toMatchObject({
      plan_id: "prepaid_12m",
      status: "sent",
      sent_at: at.toISOString(),
      giver_display_name: "Oak Street Elementary",
      complimentary_for: "school",
      message: null,
    });
    expect(tables.gifts![0]).not.toHaveProperty("payment_ref");
    expect(tables.admin_actions).toEqual([
      { admin_id: "a1", admin_email: "admin@readli.ai", action: "complimentary_issued", detail: { organization: "Oak Street Elementary", kind: "school", count: 3 } },
    ]);
  });

  it("refuse a missing name, an unknown kind or too many at once", async () => {
    const { db, tables } = fakeDb();
    await expect(issueComplimentary(db, admin, { organization: " ", kind: "school", count: 1 })).rejects.toBeInstanceOf(AdminActionError);
    await expect(issueComplimentary(db, admin, { organization: "Oak", kind: "paid", count: 1 })).rejects.toBeInstanceOf(AdminActionError);
    await expect(issueComplimentary(db, admin, { organization: "Oak", kind: "charity", count: 0 })).rejects.toBeInstanceOf(AdminActionError);
    await expect(issueComplimentary(db, admin, { organization: "Oak", kind: "charity", count: 101 })).rejects.toBeInstanceOf(AdminActionError);
    expect(tables.gifts).toBeUndefined();
  });

  it("link to the gift page", () => {
    expect(giftLink("https://readli.ai/", "ABCD-EFGH-JKMN")).toBe("https://readli.ai/gift/open?code=ABCD-EFGH-JKMN");
  });
});
