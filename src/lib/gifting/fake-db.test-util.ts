/** A small in-memory stand-in for the Supabase query builder, for gift tests. Thenable like the real one. */
export function fakeGiftsDb(initial: Record<string, unknown>[], others: Record<string, Record<string, unknown>[]> = {}) {
  const rows = initial.map((r) => ({ ...r }));
  const tables: Record<string, Record<string, unknown>[]> = { ...others, gifts: rows };
  const db = {
    from(table: string) {
      const list = (tables[table] ??= []);
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      let patch: Record<string, unknown> | null = null;
      let limit = Infinity;
      const run = () => {
        const hit = list.filter((r) => filters.every((f) => f(r))).slice(0, limit);
        if (patch) for (const r of hit) Object.assign(r, patch);
        return { data: hit.map((r) => ({ ...r })), error: null };
      };
      const q = {
        select: () => q,
        update: (p: Record<string, unknown>) => ((patch = p), q),
        insert: async (row: Record<string, unknown>) => {
          const dupe = table === "email_suppressions" && list.some((r) => r.email_hash === row.email_hash && r.contributor_id === row.contributor_id);
          if (dupe) return { error: { message: "duplicate key value violates unique constraint" } };
          list.push({ id: `${table}-${list.length + 1}`, ...row });
          return { error: null };
        },
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
        is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
        lte: (k: string, v: string) => (filters.push((r) => String(r[k]) <= v), q),
        not: (k: string) => (filters.push((r) => r[k] !== null && r[k] !== undefined), q),
        order: () => q,
        limit: (n: number) => ((limit = n), q),
        maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
        then: <T>(resolve: (v: ReturnType<typeof run>) => T) => Promise.resolve(run()).then(resolve),
      };
      return q;
    },
  };
  return { db: db as never, rows, tables };
}
