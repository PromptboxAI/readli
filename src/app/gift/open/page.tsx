import type { Metadata } from "next";
import { GiftOpen } from "@/components/gifting/GiftOpen";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";
import { draftFromParams } from "@/lib/gifting/params";

export const metadata: Metadata = { title: "You've been sent a gift | Readli", robots: { index: false } };

/** Recipient experience. Today it renders from the builder's query; with accounts it loads the gift by its code. */
export default async function GiftOpenPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const d = draftFromParams(await searchParams);
  return (
    <AdultPage>
      <PreviewNote>This is what the person you gift will see. Nothing here is sent or charged yet.</PreviewNote>
      <GiftOpen plan={d.plan} to={d.to} from={d.from} message={d.message} />
    </AdultPage>
  );
}
