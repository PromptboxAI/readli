import { GIFT_PLANS, giftPlan, type GiftPlan } from "./plans";

export interface GiftDraft {
  plan: GiftPlan;
  to: string;
  email: string;
  from: string;
  message: string;
  /** ISO date (YYYY-MM-DD), or null for right away. */
  date: string | null;
}

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined, max = 120) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim().slice(0, max);

/** Reads a gift draft from the builder's query string. Missing values fall back to a friendly sample. */
export function draftFromParams(p: Params): GiftDraft {
  const date = one(p.date, 10);
  return {
    plan: giftPlan(one(p.plan)) ?? GIFT_PLANS[1]!,
    to: one(p.to) || "Ben and family",
    email: one(p.email, 200),
    from: one(p.from) || "Nana Rose",
    message: one(p.message, 300),
    date: one(p.when) === "later" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}

export function draftToQuery(d: GiftDraft): string {
  const q = new URLSearchParams({ plan: d.plan.id, to: d.to, from: d.from });
  if (d.email) q.set("email", d.email);
  if (d.message) q.set("message", d.message);
  if (d.date) {
    q.set("when", "later");
    q.set("date", d.date);
  }
  return q.toString();
}
