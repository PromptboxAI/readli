import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { GiftCard } from "@/components/gifting/GiftCard";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { NOTICE_DAYS, UNCLAIMED_DAYS } from "@/lib/gifting/lifecycle";
import { draftFromParams, draftToQuery } from "@/lib/gifting/params";
import { giftPaymentsOpen, priceLabel } from "@/lib/gifting/plans";

export const metadata: Metadata = { title: "Gift checkout | Readli", robots: { index: false } };

export default async function GiftCheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const draft = draftFromParams(await searchParams);
  const { plan } = draft;
  const paymentsOpen = giftPaymentsOpen();
  const arrives = draft.date
    ? new Date(`${draft.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "Right away";
  const terms =
    plan.kind === "recurring"
      ? [
          "You're charged once a month until you stop.",
          `We'll email you ${NOTICE_DAYS.giverBeforeRenewal} days before each charge.`,
          "Stop any time. They keep Readli to the end of the month you've paid for, and we'll let them know.",
        ]
      : [
          "Paid once. It never renews and never charges them.",
          "Cancel for a full refund any time before they open it.",
          "We'll remind them before it ends, and they can carry on with their own plan if they like.",
        ];

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href={`/invite/gift?${draftToQuery(draft)}`} className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Edit gift
        </Link>
        <Eyebrow>Invite &amp; Gift</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Check your gift</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-4">
          <GiftCard plan={plan} to={draft.to} from={draft.from} message={draft.message} />
          <Link href={`/gift/open?${draftToQuery(draft)}`} className={`${buttonSecondary} w-full`}>
            Preview their gift
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="summary" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10">
            <h2 id="summary" className="font-display text-2xl font-semibold">
              Summary
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="font-semibold">Gift</dt>
              <dd>{plan.name}</dd>
              <dt className="font-semibold">For</dt>
              <dd className="break-words">
                {draft.to}
                {draft.email && <span className="block text-sm text-muted">{draft.email}</span>}
              </dd>
              <dt className="font-semibold">Arrives</dt>
              <dd>{arrives}</dd>
              <dt className="font-semibold">Price</dt>
              <dd>{priceLabel(plan)}</dd>
            </dl>
            <ul className="mt-2 flex flex-col gap-2 rounded-2xl bg-ivory p-4 text-sm">
              {terms.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  {t}
                </li>
              ))}
              <li className="flex gap-2">
                <span aria-hidden="true">•</span>
                Their gift link works for {Math.round(UNCLAIMED_DAYS / 30)} months.
              </li>
            </ul>
          </section>

          <section aria-labelledby="pay" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sunshine/50 p-6">
            <h2 id="pay" className="font-display text-2xl font-semibold">
              Payment
            </h2>
            {paymentsOpen ? (
              <p>You&apos;ll pay securely on the next step.</p>
            ) : (
              <p data-testid="payments-off">
                Gift checkout isn&apos;t switched on yet. Nothing has been charged, and no gift was sent.
              </p>
            )}
            <button type="button" className={`${buttonPrimary} w-full`} disabled={!paymentsOpen}>
              {plan.kind === "recurring" ? "Start sponsorship" : "Pay and send gift"}
            </button>
          </section>
        </div>
      </div>
    </AdultPage>
  );
}
