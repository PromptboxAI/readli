import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
type Result = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Page = { range: (from: number, to: number) => Result };

export async function rows(p: Result, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

export async function run(p: Result, what: string): Promise<unknown> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

/** Every row, a page at a time (Supabase returns at most 1,000 rows per request). */
export async function all(query: () => Page, what: string): Promise<Row[]> {
  const size = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += size) {
    const page = await rows(query().range(from, from + size - 1), what);
    out.push(...page);
    if (page.length < size) return out;
  }
}

/** Rows whose `column` is in `values`, a chunk at a time so the request URL stays short. */
export async function allIn(db: SupabaseClient, table: string, columns: string, column: string, values: string[], what: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200);
    out.push(...(await all(() => db.from(table).select(columns).in(column, chunk), what)));
  }
  return out;
}

export interface AuditEntry {
  actor: string;
  action: string;
  householdId?: string | null;
  voiceId?: string | null;
  runId?: string | null;
  dryRun?: boolean;
  detail?: Record<string, unknown>;
}

/** Appends to lifecycle_audit_log (append-only in the database). */
export async function writeAudit(db: SupabaseClient, entries: AuditEntry[]): Promise<void> {
  if (!entries.length) return;
  await run(
    db.from("lifecycle_audit_log").insert(
      entries.map((e) => ({
        actor: e.actor,
        action: e.action,
        household_id: e.householdId ?? null,
        voice_id: e.voiceId ?? null,
        run_id: e.runId ?? null,
        dry_run: e.dryRun ?? false,
        detail: e.detail ?? {},
      })),
    ),
    "write lifecycle log",
  );
}
