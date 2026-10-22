import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyFamilyState } from "@/lib/family/account-store";
import type { SegmentStatus } from "@/lib/family/model";
import { revisionAudit } from "@/lib/narration/revision-audit";

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Every row of a table, a page at a time (Supabase returns at most 1,000 per request). */
async function all(db: SupabaseClient, table: string, columns: string, order: string[]): Promise<Row[]> {
  const size = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += size) {
    const query = order.reduce((q, c) => q.order(c), db.from(table).select(columns));
    const { data, error } = await query.range(from, from + size - 1);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    const page = (data ?? []) as unknown as Row[];
    out.push(...page);
    if (page.length < size) return out;
  }
}

/** The Versioned Audiobooks audit over every family, read with the service key. Nothing is written. */
export async function liveRevisionAudit(db: SupabaseClient) {
  const [libraries, segments, progress, children] = await Promise.all([
    all(db, "narration_libraries", "*", ["key"]),
    all(db, "narration_segments", "library_key, sentence_id, ordinal, status, storage_key, characters, ready_at", ["library_key", "sentence_id"]),
    all(db, "child_book_progress", "*", ["child_id", "book_slug"]),
    all(db, "child_profiles", "id, household_id", ["id"]),
  ]);
  const state = emptyFamilyState();
  state.libraries = libraries.map((l) => ({
    key: l.key as string,
    voiceId: l.voice_id as string,
    voiceVersion: Number(l.voice_version),
    bookSlug: l.book_slug as string,
    edition: l.edition as string,
    textRevision: l.text_revision as string,
    modelId: l.model_id as string,
    configHash: l.config_hash as string,
    scope: l.scope as string,
    createdAt: l.created_at as string,
  }));
  state.segments = segments.map((x) => ({
    libraryKey: x.library_key as string,
    sentenceId: x.sentence_id as string,
    ordinal: Number(x.ordinal),
    status: x.status as SegmentStatus,
    jobId: null,
    storageKey: str(x.storage_key),
    characters: Number(x.characters),
    durationMs: null,
    providerCredits: null,
    attempts: 0,
    error: null,
    readyAt: str(x.ready_at),
  }));
  state.progress = progress.map((p) => ({
    childId: p.child_id as string,
    bookSlug: p.book_slug as string,
    sentence: Number(p.sentence ?? 0),
    voiceId: str(p.voice_id),
    textRevision: str(p.text_revision),
    updatedAt: p.updated_at as string,
  }));
  state.children = children.map((c) => ({ id: c.id as string, householdId: c.household_id as string, nickname: "", tint: "", guardianIds: [], deletedAt: null }));
  return revisionAudit(state);
}
