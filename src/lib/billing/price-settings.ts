import type { SupabaseClient } from "@supabase/supabase-js";
import { planConfig, type CreditPack, type PlanConfig } from "@/lib/family/plan";

/**
 * Admin-editable prices. They live in the plan_settings row and override the defaults in plan.ts,
 * so checkout and the pricing page always show what the admin saved. A change applies to new
 * purchases only: each amount gets its own Stripe price (src/lib/billing/catalog.ts), so families
 * already paying keep the price they signed up at.
 */
export interface PriceSettings {
  familyMonthlyPriceCents: number;
  familyAnnualPriceCents: number;
  extraSlotPriceCents: number;
  extraSlotPriceApproved: boolean;
  creditPacks: CreditPack[];
  /** The Family Archive's monthly price; left out when the form leaves it blank. */
  archiveMonthlyPriceCents?: number;
}

export const PRICE_COLUMNS = "family_monthly_price_cents, family_annual_price_cents, extra_slot_price_cents, extra_slot_price_approved, credit_packs";

type Row = Record<string, unknown>;

const cents = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

function packsFrom(v: unknown): CreditPack[] | null {
  if (!Array.isArray(v) || !v.length) return null;
  const packs = v.map((p: Row) => ({ id: String(p?.id ?? ""), credits: Number(p?.credits), priceCents: Number(p?.priceCents) }));
  return packs.every((p) => p.id && Number.isInteger(p.credits) && p.credits > 0 && cents(p.priceCents)) ? packs : null;
}

/** The plan with any saved admin prices on top. A missing or malformed value keeps the default. */
export function withPriceSettings(plan: PlanConfig, row: Row | null | undefined): PlanConfig {
  if (!row) return plan;
  return {
    ...plan,
    familyMonthlyPriceCents: cents(row.family_monthly_price_cents) ?? plan.familyMonthlyPriceCents,
    familyAnnualPriceCents: cents(row.family_annual_price_cents) ?? plan.familyAnnualPriceCents,
    extraSlotPriceCents: cents(row.extra_slot_price_cents) ?? plan.extraSlotPriceCents,
    extraSlotPriceApproved: typeof row.extra_slot_price_approved === "boolean" ? row.extra_slot_price_approved : plan.extraSlotPriceApproved,
    creditPacks: packsFrom(row.credit_packs) ?? plan.creditPacks,
    archiveMonthlyPriceCents: cents(row.archive_monthly_price_cents) ?? plan.archiveMonthlyPriceCents,
  };
}

/** The plan as checkout and the pricing page should see it: defaults, env overrides, then admin prices. */
export async function effectivePlan(db: SupabaseClient | null, base: PlanConfig = planConfig()): Promise<PlanConfig> {
  if (!db) return base;
  const { data } = await db.from("plan_settings").select(PRICE_COLUMNS).maybeSingle();
  // Read on its own, so prices still load before the Archive migration has run.
  const archive = await db.from("plan_settings").select("archive_monthly_price_cents").maybeSingle();
  return withPriceSettings(base, data ? { ...(data as Row), ...((archive.data as Row | null) ?? {}) } : null);
}

/** "19.99" or "$19.99" to 1999. Null unless it's a positive amount with at most two decimals. */
export function dollarsToCents(input: string): number | null {
  const m = input.trim().replace(/^\$/, "").match(/^(\d{1,5})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const value = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return value > 0 ? value : null;
}

export const MAX_CREDIT_PACKS = 5;

/**
 * Reads the admin price form. Credit packs come as pack_credits_N / pack_price_N pairs; a pair left
 * blank is dropped, and pack ids follow their order (pack-1, pack-2, ...) unless the form names them.
 */
export function parsePriceForm(get: (name: string) => string): { ok: true; settings: PriceSettings } | { ok: false; error: string } {
  const money = (name: string, label: string) => {
    const v = dollarsToCents(get(name));
    if (v === null) throw new Error(`${label} needs a price like 19.99.`);
    return v;
  };
  try {
    const creditPacks: CreditPack[] = [];
    for (let i = 1; i <= MAX_CREDIT_PACKS; i += 1) {
      const credits = get(`pack_credits_${i}`).trim();
      const price = get(`pack_price_${i}`).trim();
      if (!credits && !price) continue;
      const n = Number(credits);
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Credit pack ${i} needs a whole number of credits.`);
      creditPacks.push({ id: get(`pack_id_${i}`).trim() || `pack-${i}`, credits: n, priceCents: money(`pack_price_${i}`, `Credit pack ${i}`) });
    }
    if (!creditPacks.length) throw new Error("Keep at least one credit pack.");
    if (new Set(creditPacks.map((p) => p.id)).size !== creditPacks.length) throw new Error("Each credit pack needs its own id.");
    return {
      ok: true,
      settings: {
        familyMonthlyPriceCents: money("family_monthly", "The monthly price"),
        familyAnnualPriceCents: money("family_annual", "The annual price"),
        extraSlotPriceCents: money("extra_slot", "The extra storyteller slot"),
        extraSlotPriceApproved: get("extra_slot_approved") === "on",
        creditPacks,
        ...(get("archive_monthly").trim() ? { archiveMonthlyPriceCents: money("archive_monthly", "The Family Archive price") } : {}),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function priceSettingsRow(s: PriceSettings): Row {
  return {
    family_monthly_price_cents: s.familyMonthlyPriceCents,
    family_annual_price_cents: s.familyAnnualPriceCents,
    extra_slot_price_cents: s.extraSlotPriceCents,
    extra_slot_price_approved: s.extraSlotPriceApproved,
    credit_packs: s.creditPacks,
    ...(s.archiveMonthlyPriceCents ? { archive_monthly_price_cents: s.archiveMonthlyPriceCents } : {}),
  };
}
