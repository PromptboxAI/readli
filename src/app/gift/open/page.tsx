import type { Metadata } from "next";
import { GiftOpen } from "@/components/gifting/GiftOpen";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";
import { currentUser } from "@/lib/auth/supabase";
import { accountDb } from "@/lib/family/account-store";
import { familyAccountsEnabled } from "@/lib/family/session";
import { normalizeGiftCode } from "@/lib/gifting/codes";
import { draftFromParams } from "@/lib/gifting/params";
import { giftForCode } from "@/lib/gifting/server";

export const metadata: Metadata = { title: "You've been sent a gift | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Recipient experience. With accounts, ?code= loads the real gift; otherwise it previews the builder's draft. */
export default async function GiftOpenPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const code = typeof p.code === "string" ? normalizeGiftCode(p.code) : null;
  const db = accountDb();
  if (code && db && familyAccountsEnabled()) {
    const gift = await giftForCode(db, code);
    if (gift) {
      const signedIn = Boolean(await currentUser());
      return (
        <AdultPage>
          <GiftOpen plan={gift.plan} to={gift.to} from={gift.from} message={gift.message} live={{ code, signedIn, status: gift.status }} />
        </AdultPage>
      );
    }
    return (
      <AdultPage>
        <section role="alert" className="rounded-[var(--radius-panel)] bg-coral/20 p-6 text-center">
          <h1 className="font-display text-3xl font-semibold">We couldn&apos;t find that gift</h1>
          <p>Check the code in your gift email and try again.</p>
        </section>
      </AdultPage>
    );
  }
  const d = draftFromParams(p);
  return (
    <AdultPage>
      <PreviewNote>This is what the person you gift will see. Nothing here is sent or charged yet.</PreviewNote>
      <GiftOpen plan={d.plan} to={d.to} from={d.from} message={d.message} />
    </AdultPage>
  );
}
