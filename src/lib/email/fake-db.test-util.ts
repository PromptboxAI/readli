import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/** Enough of the Supabase query builder for the email tables, kept in memory. */
export function fakeEmailDb(tables: Record<string, Row[]> = {}, users: Record<string, string> = {}) {
  const t = (name: string) => (tables[name] ??= []);
  let seq = 0;
  const keys: Record<string, string> = { email_outbox: "dedupe_key", email_events: "provider_event_id", email_preferences: "user_id", email_delivery_suppressions: "email_hash" };
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; values: Row } | { kind: "upsert"; rows: Row[]; ignore: boolean; key: string } = { kind: "select" };
    let limit = Infinity;
    const q = {
      select: () => q,
      order: () => q,
      limit: (n: number) => ((limit = n), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      lt: (k: string, v: never) => (filters.push((r) => (r[k] as never) < v), q),
      lte: (k: string, v: never) => (filters.push((r) => (r[k] as never) <= v), q),
      gte: (k: string, v: never) => (filters.push((r) => (r[k] as never) >= v), q),
      insert: (rows: Row | Row[]) => ((op = { kind: "insert", rows: [rows].flat() }), q),
      update: (values: Row) => ((op = { kind: "update", values }), q),
      upsert: (rows: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => (
        (op = { kind: "upsert", rows: [rows].flat(), ignore: Boolean(opts?.ignoreDuplicates), key: opts?.onConflict ?? keys[name] ?? "id" }), q
      ),
      then: (resolve: (v: unknown) => void) => {
        if (op.kind === "insert") {
          const made = op.rows.map((r) => ({ id: `${name}-${++seq}`, ...r }));
          t(name).push(...made);
          return resolve({ data: made, error: null });
        }
        if (op.kind === "upsert") {
          const out: Row[] = [];
          const { key, ignore } = op;
          for (const r of op.rows) {
            const hit = t(name).find((x) => x[key] === r[key]);
            if (hit) {
              if (!ignore) {
                Object.assign(hit, r);
                out.push(hit);
              }
            } else {
              const made = { id: `${name}-${++seq}`, status: "queued", attempts: 0, ...r };
              t(name).push(made);
              out.push(made);
            }
          }
          return resolve({ data: out.map((r) => ({ ...r })), error: null });
        }
        const hits = t(name).filter((r) => filters.every((f) => f(r))).slice(0, limit);
        if (op.kind === "update") for (const r of hits) Object.assign(r, op.values);
        resolve({ data: hits.map((r) => ({ ...r })), error: null });
      },
    };
    return q;
  };
  const auth = { admin: { getUserById: async (id: string) => ({ data: users[id] ? { user: { id, email: users[id] } } : { user: null }, error: null }) } };
  return { db: { from, auth } as unknown as SupabaseClient, tables };
}
