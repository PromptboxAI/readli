import type { FamilyState } from "@/lib/family/model";
import { revisionInfo } from "@/lib/library/revisions";
import { libraryStatus, libraryText, resumePlace, type Narration } from "./narration";
import { bookText } from "./text";

export type RevisionStatus = "current" | "earlier" | "unknown";

export interface AuditedLibrary {
  key: string;
  book: string;
  voiceId: string;
  revision: string;
  status: RevisionStatus;
  /** The exact words this audiobook reads can be rebuilt, so it keeps playing with matching read-along. */
  recoverable: boolean;
  ready: number;
  total: number;
}

export interface RevisionAudit {
  libraries: AuditedLibrary[];
  totals: {
    libraries: number;
    current: number;
    earlier: number;
    unknown: number;
    /** Finished audiobooks of an earlier text, which keep playing instead of showing as unprepared. */
    earlierFinished: number;
    readySegments: number;
    readyWithoutAudio: number;
    /** Stored files more than one segment points at; cleanup never deletes these while one remains. */
    sharedFiles: number;
    progress: number;
    progressVersioned: number;
    progressUnversioned: number;
    /** Saved before texts were versioned, where the family's texts disagree about the place. */
    progressAmbiguous: number;
  };
  ambiguous: { childId: string; book: string; sentence: number; resumesAt: number }[];
}

/**
 * The historical-data audit for Versioned Audiobooks: which text every stored audiobook reads, whether
 * that text can be rebuilt, and how saved reading places will resume. It only reads.
 */
export function revisionAudit(state: FamilyState): RevisionAudit {
  const libraries = state.libraries.map((l): AuditedLibrary => {
    const info = revisionInfo(l.bookSlug, l.textRevision);
    const text = libraryText(l);
    const status = text ? libraryStatus(state, l, text) : null;
    return {
      key: l.key,
      book: bookText(l.bookSlug)?.title ?? l.bookSlug,
      voiceId: l.voiceId,
      revision: l.textRevision,
      status: !info ? "unknown" : info.current ? "current" : "earlier",
      recoverable: Boolean(text),
      ready: status?.ready ?? state.segments.filter((s) => s.libraryKey === l.key && s.status === "ready").length,
      total: status?.total ?? 0,
    };
  });

  const ready = state.segments.filter((s) => s.status === "ready");
  const uses = new Map<string, number>();
  for (const s of ready) if (s.storageKey) uses.set(s.storageKey, (uses.get(s.storageKey) ?? 0) + 1);

  const ambiguous: RevisionAudit["ambiguous"] = [];
  let unversioned = 0;
  for (const p of state.progress) {
    if (p.textRevision) continue;
    unversioned += 1;
    const today = bookText(p.bookSlug);
    const householdId = state.children.find((c) => c.id === p.childId)?.householdId;
    if (!today || !householdId) continue;
    // The text this child's narrator reads: a finished audiobook of today's text, else of an earlier one.
    const finished = state.libraries
      .filter((l) => l.bookSlug === p.bookSlug && l.voiceId === p.voiceId && (l.scope === "shared" || l.scope === householdId))
      .map((l) => ({ l, text: libraryText(l) }))
      .filter((x) => x.text && libraryStatus(state, x.l, x.text).readiness === "ready")
      .sort((a, b) => Number(b.text!.revision === today.revision) - Number(a.text!.revision === today.revision));
    const heard = { text: finished[0]?.text ?? today } as Narration;
    const place = resumePlace(state, householdId, p, heard);
    if (place.ambiguous) ambiguous.push({ childId: p.childId, book: today.title, sentence: p.sentence, resumesAt: place.sentence });
  }

  const count = (s: RevisionStatus) => libraries.filter((l) => l.status === s).length;
  return {
    libraries,
    totals: {
      libraries: libraries.length,
      current: count("current"),
      earlier: count("earlier"),
      unknown: count("unknown"),
      earlierFinished: libraries.filter((l) => l.status === "earlier" && l.recoverable && l.total > 0 && l.ready >= l.total).length,
      readySegments: ready.length,
      readyWithoutAudio: ready.filter((s) => !s.storageKey).length,
      sharedFiles: [...uses.values()].filter((n) => n > 1).length,
      progress: state.progress.length,
      progressVersioned: state.progress.length - unversioned,
      progressUnversioned: unversioned,
      progressAmbiguous: ambiguous.length,
    },
    ambiguous,
  };
}
