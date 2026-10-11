import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export interface AdminPlan {
  id: string;
  source: string;
  startsAt: string;
  endsAt: string | null;
}

export interface AdminFamily {
  id: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  members: number;
  kids: number;
  plan: AdminPlan | null;
}

export interface AdminOverview {
  totals: {
    families: number;
    grownUps: number;
    kids: number;
    voices: number;
    plans: number;
    plansBySource: Record<string, number>;
    libraries: number;
    jobsActive: number;
    jobsFailed: number;
    guestPreviews7d: number;
  };
  families: AdminFamily[];
}

/** The plan a household has right now: active, started, and not yet ended. Earliest start wins, as in the database. */
export function livePlan(rows: Row[], householdId: string, at = new Date()): AdminPlan | null {
  const now = at.getTime();
  const live = rows
    .filter(
      (e) =>
        e.household_id === householdId &&
        e.status === "active" &&
        Date.parse(e.starts_at as string) <= now &&
        (e.ends_at === null || Date.parse(e.ends_at as string) > now),
    )
    .sort((a, b) => Date.parse(a.starts_at as string) - Date.parse(b.starts_at as string))[0];
  return live ? { id: live.id as string, source: live.source as string, startsAt: live.starts_at as string, endsAt: (live.ends_at as string | null) ?? null } : null;
}

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

async function count(p: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string): Promise<number> {
  const { count: n, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return n ?? 0;
}

const FAMILY_LIMIT = 200;

/**
 * Live numbers for /admin, read with the service key. Counts come from the database; the family list
 * is the most recent households, with their owner's email so an admin can find a tester.
 */
export async function adminOverview(db: SupabaseClient, at = new Date()): Promise<AdminOverview> {
  const head = { count: "exact" as const, head: true };
  const weekAgo = new Date(at.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [families, grownUps, kids, voices, libraries, jobsActive, jobsFailed, guestPreviews7d, plans, homes] = await Promise.all([
    count(db.from("households").select("id", head), "count families"),
    count(db.from("adult_profiles").select("user_id", head), "count grown-ups"),
    count(db.from("child_profiles").select("id", head).is("deleted_at", null), "count kids"),
    count(db.from("voice_profiles").select("id", head).is("deleted_at", null), "count voices"),
    count(db.from("narration_libraries").select("key", head), "count libraries"),
    count(db.from("narration_jobs").select("id", head).in("status", ["queued", "running"]), "count jobs"),
    count(db.from("narration_jobs").select("id", head).eq("status", "failed"), "count failed jobs"),
    count(db.from("guest_sessions").select("id", head).gte("created_at", weekAgo), "count guest previews"),
    rows(db.from("household_entitlements").select("id, household_id, source, status, starts_at, ends_at").eq("status", "active"), "read plans"),
    rows(db.from("households").select("id, name, created_by, created_at").order("created_at", { ascending: false }).limit(FAMILY_LIMIT), "read families"),
  ]);

  const liveByHousehold = new Map<string, AdminPlan>();
  for (const id of new Set(plans.map((p) => p.household_id as string))) {
    const plan = livePlan(plans, id, at);
    if (plan) liveByHousehold.set(id, plan);
  }
  const plansBySource: Record<string, number> = {};
  for (const plan of liveByHousehold.values()) plansBySource[plan.source] = (plansBySource[plan.source] ?? 0) + 1;

  const ids = homes.map((h) => h.id as string);
  const [members, children] = ids.length
    ? await Promise.all([
        rows(db.from("household_members").select("household_id").in("household_id", ids).is("removed_at", null), "read members"),
        rows(db.from("child_profiles").select("household_id").in("household_id", ids).is("deleted_at", null), "read kids"),
      ])
    : [[], []];
  const owners = [...new Set(homes.map((h) => h.created_by as string))];
  const emails = new Map(
    await Promise.all(
      owners.map(async (id) => {
        const { data } = await db.auth.admin.getUserById(id);
        return [id, data.user?.email ?? null] as const;
      }),
    ),
  );
  const tally = (list: Row[], id: string) => list.filter((r) => r.household_id === id).length;

  return {
    totals: {
      families,
      grownUps,
      kids,
      voices,
      plans: liveByHousehold.size,
      plansBySource,
      libraries,
      jobsActive,
      jobsFailed,
      guestPreviews7d,
    },
    families: homes.map((h) => ({
      id: h.id as string,
      name: h.name as string,
      createdAt: h.created_at as string,
      ownerEmail: emails.get(h.created_by as string) ?? null,
      members: tally(members, h.id as string),
      kids: tally(children, h.id as string),
      plan: liveByHousehold.get(h.id as string) ?? null,
    })),
  };
}

/** Narrows the family list by family name or owner email. */
export function filterFamilies(families: AdminFamily[], query: string): AdminFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) return families;
  return families.filter((f) => f.name.toLowerCase().includes(q) || (f.ownerEmail ?? "").toLowerCase().includes(q));
}
