import type { Metadata } from "next";
import Link from "next/link";
import { buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { liveRevisionAudit } from "@/lib/admin/revision-audit";
import { accountDb } from "@/lib/family/account-store";
import { familyPage } from "@/lib/family/page-data";
import { revisionAudit, type RevisionStatus } from "@/lib/narration/revision-audit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audiobook versions | Readli admin", robots: { index: false } };

const n = (x: number) => x.toLocaleString("en-US");
const STATUS: Record<RevisionStatus, string> = { current: "Today's text", earlier: "Earlier text", unknown: "Text not found" };

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid={testId}>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

/**
 * The Versioned Audiobooks audit: which text every stored audiobook reads, and how saved reading
 * places resume. Read-only; production reads every family with the service key.
 */
export default async function AudiobookAuditPage() {
  const gate = await requireAdmin("/admin/audiobooks");
  let audit = null;
  if (gate.preview) {
    const page = await familyPage();
    if (page.enabled && page.state) audit = revisionAudit(page.state);
  } else {
    const db = accountDb();
    if (db) audit = await liveRevisionAudit(db);
  }
  const t = audit?.totals;
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Audiobook versions</h1>
        <p className="text-lg">Which text each stored audiobook reads, and how saved reading places will resume. Nothing here changes data.</p>
        <Link href="/admin" className={`${buttonSecondary} self-start`}>
          Back to the admin overview
        </Link>
      </header>
      {!audit || !t ? (
        <PreviewNote>The audit shows here once Supabase is connected.</PreviewNote>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Audiobooks" data-testid="revision-audit">
            <Stat label="Audiobooks" value={n(t.libraries)} />
            <Stat label="Reading today's text" value={n(t.current)} />
            <Stat label="Reading an earlier text" value={`${n(t.earlier)} (${n(t.earlierFinished)} finished)`} />
            <Stat label="Text not found" value={n(t.unknown)} testId="audit-unknown" />
            <Stat label="Stored sentences" value={n(t.readySegments)} />
            <Stat label="Marked ready without audio" value={n(t.readyWithoutAudio)} />
            <Stat label="Audio files shared by segments" value={n(t.sharedFiles)} />
            <Stat label="Reading places" value={`${n(t.progress)} (${n(t.progressVersioned)} with their text)`} />
            <Stat label="Saved before versioning" value={n(t.progressUnversioned)} />
            <Stat label="Unclear places (start of chapter)" value={n(t.progressAmbiguous)} testId="audit-ambiguous" />
          </section>

          {audit.ambiguous.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="ambiguous-h">
              <h2 id="ambiguous-h" className="font-display text-2xl font-semibold">Unclear reading places</h2>
              <p className="text-sm">Saved before texts were versioned, where the family&apos;s texts disagree. These resume at the start of the chapter.</p>
              <ul className="text-sm">
                {audit.ambiguous.map((a) => (
                  <li key={`${a.childId}:${a.book}`}>
                    {a.book}: saved at sentence {a.sentence + 1}, resumes at {a.resumesAt + 1} (child {a.childId.slice(0, 8)})
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2" aria-labelledby="libs-h">
            <h2 id="libs-h" className="font-display text-2xl font-semibold">Every audiobook</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/20">
                    <th className="py-2 pr-3">Book</th>
                    <th className="py-2 pr-3">Text</th>
                    <th className="py-2 pr-3">Revision</th>
                    <th className="py-2 pr-3">Sentences</th>
                    <th className="py-2">Voice</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.libraries.map((l) => (
                    <tr key={l.key} className="border-b border-ink/10">
                      <td className="py-2 pr-3">{l.book}</td>
                      <td className="py-2 pr-3">{STATUS[l.status]}{l.recoverable ? "" : " (can't rebuild)"}</td>
                      <td className="py-2 pr-3 font-mono">{l.revision}</td>
                      <td className="py-2 pr-3">{l.ready} / {l.total || "?"}</td>
                      <td className="py-2 font-mono">{l.voiceId.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdultPage>
  );
}
