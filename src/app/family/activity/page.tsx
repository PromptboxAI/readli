import type { Metadata } from "next";
import Link from "next/link";
import { parentSecondary } from "@/components/brand/buttons";
import { BackLink } from "@/components/family/BackLink";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { MarkNoticesSeen } from "@/components/family/MarkNoticesSeen";
import { HelpLink } from "@/components/help/HelpLink";
import { familyInbox, familyTimeline, INBOX_DAYS, timelineLine } from "@/lib/family/activity";
import { familyPage } from "@/lib/family/page-data";
import { planConfig } from "@/lib/family/plan";
import { homeHousehold } from "@/lib/family/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Family activity | Readli" };

/** How many timeline lines show before "Show all". */
const TIMELINE_SHOWN = 20;

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * One place for what's happened in the family: notices, each with the button that acts on it, and
 * the family's reading together, such as "Maya finished The Tale of Peter Rabbit with Grandpa".
 */
export default async function FamilyActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const { session, state } = page;
  if (session?.actor.kind !== "adult" || !state) return <NeedsGrownUp text="Only a parent or guardian can see the family's activity." />;
  const adultId = session.actor.adultId;
  const home = homeHousehold(state, adultId);
  const isGuardian = Boolean(home && state.members.some((m) => m.householdId === home && m.adultId === adultId && m.role === "guardian" && m.removedAt === null));
  if (!home || !isGuardian) return <NeedsGrownUp text="Only a parent or guardian can see the family's activity." />;
  const notices = familyInbox(state, home, adultId);
  const timeline = familyTimeline(state, home, planConfig());
  const showAll = (await searchParams).all === "1";
  const shown = showAll ? timeline : timeline.slice(0, TIMELINE_SHOWN);
  return (
    <FamilyShell>
      <PreviewNote />
      <BackLink href="/family" label="Family Home" />
      <h1 className="font-display text-4xl font-semibold">Family activity</h1>

      <section className="flex flex-col gap-3" aria-labelledby="notices-h" data-testid="notices">
        <h2 id="notices-h" className="font-display text-2xl font-semibold">
          Notices
        </h2>
        {notices.length ? (
          <ul className="flex flex-col gap-2">
            {notices.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 ring-2 ring-ink/10" data-testid="notice">
                <div className="min-w-0 flex-1">
                  <p>
                    {n.unread && (
                      <span className="mr-2 rounded-full bg-sunshine px-2 py-0.5 text-xs font-semibold" data-testid="notice-new">
                        New
                      </span>
                    )}
                    {n.text}
                  </p>
                  <p className="text-sm text-muted">{day(n.at)}</p>
                </div>
                <Link href={n.action.href} className={parentSecondary}>
                  {n.action.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No notices in the last {INBOX_DAYS} days. When a story is ready or a storyteller&apos;s voice is ready, it shows up here.</p>
        )}
        {notices[0] && notices.some((n) => n.unread) && <MarkNoticesSeen through={notices[0].at} />}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="timeline-h" data-testid="timeline">
        <h2 id="timeline-h" className="font-display text-2xl font-semibold">
          Reading together
        </h2>
        {timeline.length ? (
          <>
            <ol className="flex flex-col gap-2">
              {shown.map((e) => (
                <li key={`${e.childId}-${e.slug}`} className="flex items-center gap-3" data-testid="timeline-entry">
                  <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full font-display font-semibold ${e.tint}`}>
                    {e.finished ? "★" : e.childName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p>
                      <Link href={`/family/books/${e.slug}`} className="underline-offset-4 hover:underline">
                        {timelineLine(e)}
                      </Link>
                    </p>
                    <p className="text-sm text-muted">{day(e.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
            {timeline.length > TIMELINE_SHOWN && (
              <Link href={showAll ? "/family/activity" : "/family/activity?all=1"} className="self-start font-semibold underline underline-offset-4">
                {showAll ? "Show fewer" : `Show all ${timeline.length}`}
              </Link>
            )}
          </>
        ) : (
          <p className="text-muted">When your kids listen in Readli Kids, the books they finish, and whose voice read them, show up here.</p>
        )}
      </section>
      <HelpLink slug="family-activity" />
    </FamilyShell>
  );
}
