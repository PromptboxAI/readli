import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * An in-memory stand-in for the parts of the Supabase client the server code uses: table queries with
 * the common filters, inserts, updates, deletes and upserts (with onConflict and ignoreDuplicates),
 * storage remove and list, auth admin lookups and deletion, and named rpc handlers. Unique columns
 * can be declared so an insert that would duplicate one fails the way Postgres does.
 */
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export interface FakeOptions {
  files?: Record<string, string[]>;
  users?: Record<string, { email: string | null; email_confirmed_at?: string | null }>;
  unique?: Record<string, string[]>;
  rpc?: Record<string, (args: Row, tables: Record<string, Row[]>) => unknown>;
}

let seq = 0;

export function fakeSupabase(tables: Record<string, Row[]> = {}, opts: FakeOptions = {}) {
  const removed: Record<string, string[]> = {};
  const auth = { deleted: [] as string[], metadata: {} as Record<string, unknown> };
  const rpcs: { name: string; args: Row }[] = [];
  const t = (name: string) => (tables[name] ??= []);
  const cmp = (a: unknown, b: unknown) => (a === b ? 0 : a === null || a === undefined ? -1 : b === null || b === undefined ? 1 : String(a) < String(b) ? -1 : 1);

  const from = (name: string) => {
    const filters: Filter[] = [];
    let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "delete" } | { kind: "insert"; rows: Row[] } | { kind: "upsert"; rows: Row[]; onConflict: string; ignore: boolean } = { kind: "select" };
    let returning = false;
    let limit: number | null = null;
    let range: [number, number] | null = null;
    let single = false;
    let order: { col: string; asc: boolean } | null = null;

    const violates = (row: Row, except?: Row) =>
      (opts.unique?.[name] ?? []).some((col) => row[col] !== undefined && row[col] !== null && t(name).some((x) => x !== except && x[col] === row[col]));

    const result = (): { data: unknown; error: { message: string } | null } => {
      if (op.kind === "insert") {
        const made: Row[] = [];
        for (const r of op.rows) {
          const row = { id: r.id ?? `id-${++seq}`, ...r };
          if (violates(row)) return { data: null, error: { message: `duplicate key value violates unique constraint on ${name}` } };
          t(name).push(row);
          made.push(row);
        }
        return { data: returning ? made.map((r) => ({ ...r })) : null, error: null };
      }
      if (op.kind === "upsert") {
        const made: Row[] = [];
        const keys = op.onConflict.split(",");
        for (const r of op.rows) {
          const old = t(name).find((x) => keys.every((k) => x[k] === r[k]));
          if (old) {
            if (!op.ignore) {
              Object.assign(old, r);
              made.push(old);
            }
          } else {
            const row = { id: r.id ?? `id-${++seq}`, ...r };
            t(name).push(row);
            made.push(row);
          }
        }
        return { data: returning ? made.map((r) => ({ ...r })) : null, error: null };
      }
      let hit = t(name).filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") {
        const values = op.values;
        for (const r of hit) {
          if (violates({ ...r, ...values }, r)) return { data: null, error: { message: `duplicate key value violates unique constraint on ${name}` } };
        }
        for (const r of hit) Object.assign(r, values);
        return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      if (op.kind === "delete") {
        tables[name] = t(name).filter((r) => !hit.includes(r));
        return { data: returning ? hit : null, error: null };
      }
      if (order) {
        const { col, asc } = order;
        hit = [...hit].sort((a, b) => (asc ? cmp(a[col], b[col]) : cmp(b[col], a[col])));
      }
      if (range) hit = hit.slice(range[0], range[1] + 1);
      if (limit !== null) hit = hit.slice(0, limit);
      const data = hit.map((r) => ({ ...r }));
      return { data: single ? (data[0] ?? null) : data, error: null };
    };

    const q = {
      select: () => ((returning = op.kind !== "select"), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      not: (k: string, o: string, v: unknown) => (filters.push((r) => (o === "is" ? (r[k] ?? null) !== v : r[k] !== v)), q),
      lt: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) < 0), q),
      lte: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) <= 0), q),
      gt: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) > 0), q),
      gte: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) >= 0), q),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), q),
      limit: (n: number) => ((limit = n), q),
      range: (a: number, b: number) => ((range = [a, b]), q),
      maybeSingle: () => ((single = true), q),
      single: () => ((single = true), q),
      update: (values: Row) => ((op = { kind: "update", values }), q),
      delete: () => ((op = { kind: "delete" }), q),
      insert: (rows: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] }), q),
      upsert: (rows: Row | Row[], o: { onConflict: string; ignoreDuplicates?: boolean }) => (
        (op = { kind: "upsert", rows: Array.isArray(rows) ? rows : [rows], onConflict: o.onConflict, ignore: Boolean(o.ignoreDuplicates) }), q
      ),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        try {
          resolve(result());
        } catch (e) {
          reject?.(e);
        }
      },
    };
    return q;
  };

  const db = {
    from,
    rpc: async (name: string, args: Row) => {
      rpcs.push({ name, args });
      const handler = opts.rpc?.[name];
      return { data: handler ? handler(args, tables) : null, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (keys: string[]) => ((removed[bucket] ??= []).push(...keys), { data: [], error: null }),
        list: async (folder: string) => ({
          data: (opts.files?.[bucket] ?? []).filter((k) => k.startsWith(`${folder}/`)).map((k) => ({ id: k, name: k.slice(folder.length + 1) })),
          error: null,
        }),
      }),
    },
    auth: {
      admin: {
        getUserById: async (id: string) => {
          const u = opts.users?.[id];
          return u ? { data: { user: { id, email: u.email, email_confirmed_at: u.email_confirmed_at ?? null } }, error: null } : { data: { user: null }, error: { message: "not found" } };
        },
        deleteUser: async (id: string) => (auth.deleted.push(id), { data: {}, error: null }),
        updateUserById: async (id: string, attrs: { user_metadata: Row }) => ((auth.metadata[id] = attrs.user_metadata), { data: {}, error: null }),
      },
    },
  } as unknown as SupabaseClient;
  return { db, tables, removed, auth, rpcs };
}
