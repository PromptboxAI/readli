import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor } from "@/lib/family/model";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { MemoryFamilyStore } from "@/lib/family/service";
import { grantPromoCredits, requestGeneration } from "@/lib/narration/narration";
import { supportCredits, takeBackGrant } from "./support-credits";
import { AdminActionError } from "./tester-plans";

const mom: Actor = { kind: "adult", adultId: "sara" };
const H = DEMO_HOUSEHOLD_ID;
let tick = Date.parse("2026-11-01T00:00:00Z");
const clock = () => new Date((tick += 1000));
const untouched = new Proxy({}, { get: () => { throw new Error("database used"); } }) as unknown as SupabaseClient;

describe("support: credits", () => {
  it("lists monthly and granted credits with what's left, and each preparation's charges", async () => {
    const state = demoFamilyState();
    const store = new MemoryFamilyStore(state, DEFAULT_PLAN);
    const promo = await grantPromoCredits(store, H, 50, 0, "Sorry about that", clock);
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: "the-lion-and-the-mouse", scope: "book" }, clock);
    const { lots, charges } = supportCredits(state, DEFAULT_PLAN, H, new Date(tick).toISOString());
    expect(lots.some((l) => l.source === "subscription" && l.live)).toBe(true);
    const grant = lots.find((l) => l.id === promo.id)!;
    expect(grant).toMatchObject({ source: "promotional", note: "Sorry about that", live: true });
    expect(charges[0]).toMatchObject({ jobId: job!.id, status: "Preparing" });
    expect(charges[0]!.held).toBeGreaterThan(0);
    // Monthly credits are spent first, so the grant is untouched and can be taken back.
    expect(grant).toMatchObject({ left: promo.credits, held: 0, canTakeBack: true });
  });

  it("never takes back purchased or monthly credits", async () => {
    const state = demoFamilyState();
    const monthly = supportCredits(state, DEFAULT_PLAN, H, new Date(tick).toISOString()).lots.find((l) => l.source === "subscription")!;
    const err = await takeBackGrant(untouched, state, DEFAULT_PLAN, H, monthly.id, new Date(tick)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as Error).message).toMatch(/Only promotional credits/);
  });
});
