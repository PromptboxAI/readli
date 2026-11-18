import type { Metadata } from "next";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { accountDb } from "@/lib/family/account-store";
import { BannerBar } from "@/components/marketing/BannerBar";
import { BANNER_LIMITS, BANNER_STYLES, bannerLive, readSiteBanner, readliDay } from "@/lib/marketing/site-banner";
import { saveBannerAction } from "./actions";
import { BackTo } from "@/components/nav/BackTrail";

export const metadata: Metadata = { title: "Top banner | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const input = "min-h-11 rounded-xl border-2 border-ink/15 bg-white px-3";
const dayBefore = (iso: string | null) => (iso ? readliDay(new Date(new Date(iso).getTime() - 1).toISOString()) : "");

/** Kevin, 2026-11-15: the slim announcement bar across the top of the public site. */
export default async function AdminBannerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin("/admin/banner");
  const p = await searchParams;
  const db = gate.preview ? null : accountDb();
  const banner = await readSiteBanner(db);
  const live = bannerLive(banner);

  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Top banner</h1>
        <p className="text-lg">
          A slim bar above the header on the public website. It never shows in Readli Kids, the parent portal, invitations or admin, and visitors can close it for the rest of
          their visit.
        </p>
        <BackTo fallback={{ href: "/admin", label: "admin" }} look="back-to" className="text-sm underline underline-offset-4" />
      </header>
      {typeof p.ok === "string" && <p className="rounded-2xl bg-mint/60 px-4 py-3">{p.ok}</p>}
      {typeof p.err === "string" && (
        <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">
          {p.err}
        </p>
      )}
      {!db && <PreviewNote>Connect Supabase to edit the banner.</PreviewNote>}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold">On the site now</h2>
        {live ? (
          <div className="overflow-hidden rounded-2xl">
            <BannerBar style={banner.style} message={banner.message} linkText={banner.linkText} linkUrl={banner.linkUrl} />
          </div>
        ) : (
          <p className="text-muted">{banner.enabled && banner.message ? "Nothing: today is outside the banner's dates." : "Nothing: the banner is off."}</p>
        )}
      </section>

      <form action={saveBannerAction} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 ring-2 ring-ink/10">
        <label className="flex items-center gap-3 font-semibold">
          <input type="checkbox" name="enabled" defaultChecked={banner.enabled} className="size-5" />
          Show the banner
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Message</span>
          <textarea name="message" defaultValue={banner.message} maxLength={BANNER_LIMITS.message} rows={2} className={`${input} py-2`} />
          <span className="text-sm text-muted">
            One short sentence reads best. Wrap words in *asterisks* to highlight them, like &ldquo;Save *20% off* this week&rdquo;. Up to {BANNER_LIMITS.message} characters.
          </span>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Look</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {BANNER_STYLES.map((look) => (
              <label key={look.id} className="flex cursor-pointer flex-col gap-2 rounded-2xl bg-white p-3 ring-2 ring-ink/10 has-[:checked]:ring-coral-deep">
                <span className="flex items-center gap-2">
                  <input type="radio" name="style" value={look.id} defaultChecked={banner.style === look.id} className="size-5" />
                  <span className="font-semibold">{look.label}</span>
                </span>
                <span className="pointer-events-none overflow-hidden rounded-xl">
                  <BannerBar style={look.id} message="Gift a voice, *every night*." linkText="Learn more" linkUrl="/gifts" />
                </span>
                <span className="text-sm text-muted">{look.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Link text</span>
            <input name="link_text" defaultValue={banner.linkText} maxLength={BANNER_LIMITS.linkText} placeholder="See Readli gifts" className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Link goes to</span>
            <input name="link_url" defaultValue={banner.linkUrl} maxLength={BANNER_LIMITS.linkUrl} placeholder="/gifts" className={input} />
          </label>
        </div>
        <p className="-mt-2 text-sm text-muted">Optional. A Readli page like /gifts, or a full address starting with https://.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Show from</span>
            <input type="date" name="starts_on" defaultValue={readliDay(banner.startsAt)} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Show until (last day)</span>
            <input type="date" name="ends_on" defaultValue={dayBefore(banner.endsAt)} className={input} />
          </label>
        </div>
        <p className="-mt-2 text-sm text-muted">Optional. Leave a date empty for no limit. Days are in New York time.</p>
        <button type="submit" className={`${buttonPrimary} self-start`}>
          Save
        </button>
      </form>
    </AdultPage>
  );
}
