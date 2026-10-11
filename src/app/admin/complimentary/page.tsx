import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { IssueForm } from "./IssueForm";

export const metadata: Metadata = { title: "Complimentary memberships | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Free annual Readli Family memberships for schools, charities, fundraisers and giveaways. */
export default async function ComplimentaryPage() {
  const gate = await requireAdmin("/admin/complimentary");
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin" className="underline underline-offset-4">
            Admin
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Complimentary memberships</h1>
        <p className="text-lg">
          Give schools, charities, fundraisers and promotional giveaways a year of Readli Family for each family. Families open their link
          like a gift: no card, nothing to cancel, and the same narrator slots and monthly narration credits as a paid plan.
        </p>
      </header>
      {gate.preview && <PreviewNote>Issuing memberships needs sign-in and Supabase connected. This shows the form only.</PreviewNote>}
      <IssueForm />
    </AdultPage>
  );
}
