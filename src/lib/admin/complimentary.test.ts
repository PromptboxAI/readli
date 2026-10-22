import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { normalizeGiftCode } from "@/lib/gifting/codes";
import { hashGiftCode } from "@/lib/gifting/codes.server";
import { GiftCodeCipher } from "@/lib/gifting/code-cipher";
import { complimentaryHeadline, certificateHeadline, presentedLine, recipientLine } from "@/lib/gifting/complimentary-copy";
import {
  batchPrefix,
  certificateLabel,
  claimLink,
  issueComplimentary,
  issuedStatus,
  membershipArtwork,
  revealCode,
  revokeAndReplace,
  validateComplimentary,
  type ComplimentaryRequest,
} from "./complimentary";
import { AdminActionError } from "./tester-plans";

type Row = Record<string, unknown>;

/** Enough of Supabase for these admin actions: filters, inserts, updates and the issue RPC. */
function fakeDb(tables: Record<string, Row[]> = {}) {
  const t = (name: string) => (tables[name] ??= []);
  const rpcCalls: { name: string; args: Row }[] = [];
  let seq = 0;
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "insert" | "update" = "select";
    let payload: Row | Row[] = {};
    let one = false;
    let desc: string | null = null;
    const run = () => {
      if (op === "insert") {
        const rows = [payload].flat().map((r) => ({ id: `id-${++seq}`, ...r }));
        t(name).push(...rows);
        return { data: rows, error: null };
      }
      const hits = t(name).filter((r) => filters.every((f) => f(r)));
      if (op === "update") hits.forEach((r) => Object.assign(r, payload));
      const sorted = desc ? [...hits].sort((a, b) => Number(b[desc!] ?? 0) - Number(a[desc!] ?? 0)) : hits;
      return { data: one ? (sorted[0] ?? null) : sorted, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), q),
      update: (p: Row) => ((op = "update"), (payload = p), q),
      eq: (k: string, v: unknown) => (filters.push((r) => (k === "detail->>batch_id" ? (r.detail as Row)?.batch_id === v : r[k] === v)), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      not: () => q,
      order: (k: string, o?: { ascending?: boolean }) => ((desc = o?.ascending === false ? k : null), q),
      limit: () => q,
      maybeSingle: () => ((one = true), q),
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  const rpc = async (name: string, args: Row) => {
    rpcCalls.push({ name, args });
    const batch = args.p_batch as Row;
    const existing = t("complimentary_batches").find((b) => b.request_key === batch.request_key);
    if (existing) return { data: [{ batch_id: existing.id, created: false }], error: null };
    const id = "11111111-1111-4111-8111-111111111111";
    t("complimentary_batches").push({ id, created_at: "2026-10-22T00:00:00Z", ...batch });
    for (const g of args.p_gifts as Row[]) {
      t("gifts").push({
        id: `22222222-2222-4222-8222-${String(++seq).padStart(12, "0")}`,
        giver_id: batch.issued_by,
        status: "sent",
        sent_at: "2026-10-22T00:00:00Z",
        giver_display_name: batch.sponsor_name,
        event_name: batch.event_name,
        message: batch.message,
        complimentary_for: batch.occasion,
        claim_by: batch.claim_by,
        batch_id: id,
        redeemed_at: null,
        ...g,
        code_encrypted: `\\x${g.code_encrypted}`,
      });
    }
    return { data: [{ batch_id: id, created: true }], error: null };
  };
  return { db: { from, rpc } as unknown as SupabaseClient, tables, rpcCalls };
}

const admin = { id: "a1", email: "admin@readli.ai", name: "Admin" };
const cipher = new GiftCodeCipher("test-secret");
const AT = new Date("2026-10-22T12:00:00Z");
const raffle = (over: Partial<ComplimentaryRequest> = {}): ComplimentaryRequest => ({
  requestKey: "req-00000001",
  months: 12,
  sponsor: "readli",
  occasion: "raffle",
  eventName: "Mount Elementary Basket Dinner",
  recipient: "unknown",
  count: 3,
  message: "Thank you for supporting Mount Elementary!",
  label: "Mount Elementary raffle, Oct 2026",
  claimBy: "2027-10-22",
  ...over,
});

describe("complimentary membership copy", () => {
  it("congratulate an unknown winner without inventing a name or calling the event the sender", () => {
    expect(complimentaryHeadline({ months: 12, occasion: "raffle" })).toBe("You've won a year of Readli Family!");
    expect(complimentaryHeadline({ months: 3, occasion: "school" })).toBe("Enjoy 3 months of Readli Family!");
    expect(presentedLine({ sponsorName: "Readli", sponsorIsReadli: true, eventName: "Mount Elementary Basket Dinner" })).toBe(
      "Donated by Readli for the Mount Elementary Basket Dinner.",
    );
    expect(presentedLine({ sponsorName: "Oak Street PTA", sponsorIsReadli: false, eventName: "The Spring Fair" })).toBe("Presented by Oak Street PTA for The Spring Fair.");
    expect(presentedLine({ sponsorName: "Readli", sponsorIsReadli: true, eventName: null })).toBe("Donated by Readli.");
    expect(recipientLine(null)).toBeNull();
    expect(recipientLine("  ")).toBeNull();
    expect(recipientLine("Maya Garcia")).toBe("For Maya Garcia");
    expect(certificateHeadline(1)).toBe("A month of Readli Family");
  });

  it("label certificates by event initials, and claim links keep the code after #", () => {
    expect(batchPrefix("Mount Elementary Basket Dinner", "Readli")).toBe("MEB");
    expect(batchPrefix(null, "Oak Street PTA")).toBe("OSP");
    expect(batchPrefix("The Gala", "Readli")).toBe("GAL");
    expect(certificateLabel("MEB", 4)).toBe("MEB-004");
    expect(claimLink("https://readli.ai/", "ABCD-EFGH-JKMN")).toBe("https://readli.ai/claim#ABCD-EFGH-JKMN");
  });
});

describe("issuing complimentary memberships", () => {
  it("issue a batch of one-time codes, store them hashed and encrypted, and log no code", async () => {
    const { db, tables, rpcCalls } = fakeDb();
    const { batchId, created } = await issueComplimentary(db, admin, raffle(), cipher, AT);
    expect(created).toBe(true);
    const gifts = tables.gifts!;
    expect(gifts).toHaveLength(3);
    expect(gifts.map((g) => g.certificate_no)).toEqual([1, 2, 3]);
    expect(new Set(gifts.map((g) => g.code_hash)).size).toBe(3);
    for (const g of gifts) {
      const code = cipher.decrypt(g.code_encrypted as string)!;
      expect(normalizeGiftCode(code)).toBe(code);
      expect(hashGiftCode(code)).toBe(g.code_hash);
      expect(g.code_last4).toBe(code.replace(/-/g, "").slice(-4));
      expect(g).toMatchObject({ plan_id: "prepaid_12m", recipient_name: null, giver_display_name: "Readli", event_name: "Mount Elementary Basket Dinner" });
      expect(JSON.stringify(tables.admin_actions)).not.toContain(code);
    }
    expect(rpcCalls[0]!.args.p_batch).toMatchObject({ prefix: "MEB", sponsor_is_readli: true, months: 12, claim_by: "2027-10-22T23:59:59.000Z" });
    expect(tables.admin_actions).toEqual([
      {
        id: expect.any(String),
        admin_id: "a1",
        admin_email: "admin@readli.ai",
        action: "complimentary_issued",
        detail: { batch_id: batchId, count: 3, months: 12, sponsor: "Readli", event: "Mount Elementary Basket Dinner", occasion: "raffle" },
      },
    ]);
  });

  it("return the same batch for a repeated submit instead of issuing more", async () => {
    const { db, tables } = fakeDb();
    const first = await issueComplimentary(db, admin, raffle(), cipher, AT);
    const again = await issueComplimentary(db, admin, raffle(), cipher, AT);
    expect(again).toEqual({ batchId: first.batchId, created: false });
    expect(tables.gifts).toHaveLength(3);
    expect(tables.admin_actions).toHaveLength(1);
  });

  it("support 1 and 3 months, a named organization and a named adult", async () => {
    expect(validateComplimentary(raffle({ months: 3, sponsor: "organization", organization: " Oak  PTA " }), AT)).toMatchObject({
      months: 3,
      sponsorName: "Oak PTA",
      sponsorIsReadli: false,
    });
    expect(validateComplimentary(raffle({ recipient: "named", recipientName: "Maya", recipientEmail: "Maya@Example.com", count: 1 }), AT)).toMatchObject({
      recipientName: "Maya",
      recipientEmail: "maya@example.com",
    });
  });

  it("refuse what doesn't make sense", () => {
    const bad = (over: Partial<ComplimentaryRequest>) => expect(() => validateComplimentary(raffle(over), AT)).toThrow(AdminActionError);
    bad({ months: 6 });
    bad({ sponsor: "organization", organization: " " });
    bad({ occasion: "paid" });
    bad({ count: 0 });
    bad({ count: 101 });
    bad({ recipient: "named", recipientName: "" , count: 1 });
    bad({ recipient: "named", recipientName: "Maya", count: 2 });
    bad({ recipient: "named", recipientName: "Maya", recipientEmail: "nope", count: 1 });
    bad({ claimBy: "2026-10-01" });
    bad({ claimBy: "2030-01-01" });
    bad({ requestKey: "x" });
  });
});

describe("issued memberships", () => {
  it("know unclaimed, claimed, revoked and expired codes apart", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(issuedStatus({ status: "sent", claim_by: "2027-01-01T00:00:00Z" }, now)).toBe("unclaimed");
    expect(issuedStatus({ status: "active", redeemed_at: "2026-10-30" }, now)).toBe("claimed");
    expect(issuedStatus({ status: "cancelled" }, now)).toBe("revoked");
    expect(issuedStatus({ status: "sent", claim_by: "2026-10-30T00:00:00Z" }, now)).toBe("expired");
    expect(issuedStatus({ status: "sent", sent_at: "2025-10-01T00:00:00Z" }, now)).toBe("expired");
  });

  it("give the same code for artwork every time, and record each reveal without the code", async () => {
    const { db, tables } = fakeDb();
    await issueComplimentary(db, admin, raffle({ count: 1 }), cipher, AT);
    const id = tables.gifts![0]!.id as string;
    const a = await membershipArtwork(db, cipher, id);
    const b = await membershipArtwork(db, cipher, id);
    expect(a!.code).toBe(b!.code);
    expect(a!.certificate).toBe("MEB-001");
    expect(hashGiftCode(a!.code)).toBe(tables.gifts![0]!.code_hash);
    expect(tables.gifts).toHaveLength(1);
    const shown = await revealCode(db, admin, cipher, id);
    expect(shown.code).toBe(a!.code);
    expect(tables.admin_actions!.at(-1)).toMatchObject({ action: "complimentary_code_revealed", detail: { certificate: "MEB-001" } });
    expect(JSON.stringify(tables.admin_actions)).not.toContain(a!.code);
  });

  it("never make artwork from a code that doesn't match the stored hash", async () => {
    const { db, tables } = fakeDb();
    await issueComplimentary(db, admin, raffle({ count: 1 }), cipher, AT);
    tables.gifts![0]!.code_hash = hashGiftCode("ZZZZ-ZZZZ-ZZZZ");
    expect(await membershipArtwork(db, cipher, tables.gifts![0]!.id as string)).toBeNull();
    expect(await membershipArtwork(db, new GiftCodeCipher("other"), tables.gifts![0]!.id as string)).toBeNull();
  });

  it("revoke an unclaimed code and issue a replacement with a new code, once", async () => {
    const { db, tables } = fakeDb();
    await issueComplimentary(db, admin, raffle({ count: 2 }), cipher, AT);
    const first = tables.gifts![0]!;
    const oldCode = cipher.decrypt(first.code_encrypted as string);
    expect(await revokeAndReplace(db, admin, cipher, first.id as string, AT)).toEqual({ certificate: "MEB-001", replacement: "MEB-003" });
    expect(first).toMatchObject({ status: "cancelled", revoked_at: AT.toISOString() });
    const replacement = tables.gifts!.find((g) => g.certificate_no === 3)!;
    expect(first.replaced_by).toBe(replacement.id);
    expect(replacement).toMatchObject({ status: "sent", complimentary_for: "raffle", event_name: "Mount Elementary Basket Dinner" });
    expect(cipher.decrypt(replacement.code_encrypted as string)).not.toBe(oldCode);
    await expect(revokeAndReplace(db, admin, cipher, first.id as string, AT)).rejects.toBeInstanceOf(AdminActionError);
    tables.gifts![1]!.status = "active";
    tables.gifts![1]!.redeemed_at = "2026-10-23";
    await expect(revokeAndReplace(db, admin, cipher, tables.gifts![1]!.id as string, AT)).rejects.toBeInstanceOf(AdminActionError);
    expect(tables.admin_actions!.filter((a) => a.action === "complimentary_revoked")).toHaveLength(1);
  });
});
