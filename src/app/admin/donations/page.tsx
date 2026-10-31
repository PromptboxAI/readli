import type { Metadata } from "next";
import Link from "next/link";
import { buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { effectivePlan } from "@/lib/billing/price-settings";
import { EVENT_TYPES, money, ORG_TYPES, STATUS_LABELS, type EventType, type OrgType } from "@/lib/donations/program";
import { listRequests, programStats, type AdminRequest, type RequestFilter } from "@/lib/donations/server";
import { accountDb } from "@/lib/family/account-store";

export const metadata: Metadata = { title: "Readli Gives Back | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const FILTERS: { id: RequestFilter; label: string }[] = [
  { id: "review", label: "To review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Declined" },
  { id: "all", label: "All" },
];
const REDEMPTION: Record<AdminRequest["redemption"], string> = { none: "—", unredeemed: "Not yet redeemed", redeemed: "Redeemed", expired: "Expired unredeemed", revoked: "Revoked" };
const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

type Params = Record<string, string | string[] | undefined>;

/** Readli Gives Back: the review queue, program numbers and every request (spec section 6, Phase 1). */
export default async function DonationsAdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin/donations");
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.id === params.show)?.id ?? "review";
  const q = typeof params.q === "string" ? params.q : "";
  const db = gate.preview ? null : accountDb();
  const [stats, rows, plan] = db ? await Promise.all([programStats(db), listRequests(db, filter, q), effectivePlan(db)]) : [null, [], null];

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin" className="underline underline-offset-4">
            Admin
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Readli Gives Back</h1>
        <p className="text-lg">
          Donation requests from <Link href="/donations" className="underline underline-offset-4">/donations</Link>. Approving one issues a 12-month certificate and emails it to
          the applicant. Every request is reviewed by a person for now; the automatic checks show as flags.
        </p>
      </header>
      {!stats || !plan ? (
        <PreviewNote>Requests and numbers show here once sign-in and Supabase are connected.</PreviewNote>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Program numbers" data-testid="donation-stats">
            <Stat label="Applications" value={stats.applications} />
            <Stat label="Waiting for review" value={stats.pending} />
            <Stat label="Waiting on applicant" value={stats.needsInfo} />
            <Stat label="Approved" value={stats.approved} />
            <Stat label="Declined" value={stats.rejected} />
            <Stat label="Certificates issued" value={stats.certificatesIssued} />
            <Stat label="Redeemed" value={stats.redeemed} />
            <Stat label="Active gifted memberships" value={stats.activeMemberships} />
            <Stat label="Ended memberships" value={stats.expiredMemberships} />
            <Stat label="Retail value donated" value={money(stats.certificatesIssued * plan.familyAnnualPriceCents)} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="requests-h">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="requests-h" className="font-display text-2xl font-semibold">
                Requests
              </h2>
              <a href="/api/admin/donations/export" className={buttonSecondary} download>
                Export CSV
              </a>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Filter requests">
              {FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={`/admin/donations?show=${f.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  aria-current={f.id === filter ? "page" : undefined}
                  className={`rounded-full px-4 py-2 font-semibold ${f.id === filter ? "bg-ink text-white" : "bg-ink/5"}`}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
            <form className="flex gap-2" role="search">
              <input type="hidden" name="show" value={filter} />
              <label htmlFor="dq" className="sr-only">
                Search requests
              </label>
              <input id="dq" name="q" defaultValue={q} placeholder="Organization, event, email or reference" className="min-h-11 flex-1 rounded-2xl bg-surface px-4 ring-2 ring-ink/20" />
              <button className={buttonSecondary}>Search</button>
            </form>
            {rows.length === 0 ? (
              <p className="rounded-2xl bg-ink/5 p-4">{filter === "review" ? "Nothing waiting for review." : "No requests here yet."}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl ring-2 ring-ink/10">
                <table className="w-full min-w-[900px] text-left text-sm" data-testid="donation-requests">
                  <thead className="bg-ink/5">
                    <tr>
                      {["Reference", "Organization", "State", "Event", "Event date", "Contact", "Applied", "Checks", "Status", "Redemption"].map((h) => (
                        <th key={h} scope="col" className="px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-ink/10 align-top">
                        <td className="px-3 py-2">
                          <Link href={`/admin/donations/${r.id}`} className="font-semibold underline underline-offset-4">
                            {r.reference}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {r.orgName}
                          {r.orgType !== "other" && <span className="block text-muted">{ORG_TYPES[r.orgType as OrgType] ?? r.orgType}</span>}
                        </td>
                        <td className="px-3 py-2">{r.state ?? "—"}</td>
                        <td className="px-3 py-2">
                          {r.eventName}
                          {r.eventType !== "other" && <span className="block text-muted">{EVENT_TYPES[r.eventType as EventType] ?? r.eventType}</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{shortDate(r.eventDate)}</td>
                        <td className="px-3 py-2">{r.contactEmail}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{shortDate(r.createdAt)}</td>
                        <td className="px-3 py-2">{r.flags.length ? <span className="rounded-full bg-sunshine/60 px-2 py-0.5 font-semibold">{r.flags.length} to check</span> : "Clear"}</td>
                        <td className="px-3 py-2">{STATUS_LABELS[r.status]}</td>
                        <td className="px-3 py-2">{REDEMPTION[r.redemption]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AdultPage>
  );
}
