/** A small in-memory stand-in for the Supabase query builder, for gift tests. Thenable like the real one. */
export function fakeGiftsDb(initial: Record<string, unknown>[]) {
  const rows = initial.map((r) => ({ ...r }));
  const db = {
    from() {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      let patch: Record<string, unknown> | null = null;
      let limit = Infinity;
      const run = () => {
        const hit = rows.filter((r) => filters.every((f) => f(r))).slice(0, limit);
        if (patch) for (const r of hit) Object.assign(r, patch);
        return { data: hit.map((r) => ({ ...r })), error: null };
      };
      const q = {
        select: () => q,
        update: (p: Record<string, unknown>) => ((patch = p), q),
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
        lte: (k: string, v: string) => (filters.push((r) => String(r[k]) <= v), q),
        not: (k: string) => (filters.push((r) => r[k] !== null && r[k] !== undefined), q),
        order: () => q,
        limit: (n: number) => ((limit = n), q),
        then: <T>(resolve: (v: ReturnType<typeof run>) => T) => Promise.resolve(run()).then(resolve),
      };
      return q;
    },
  };
  return { db: db as never, rows };
}
