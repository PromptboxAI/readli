import type { Metadata } from "next";
import Link from "next/link";
import { AccountSettings } from "@/components/account/AccountSettings";
import { buttonPrimary } from "@/components/brand/buttons";
import { FamilyOff, FamilyShell, NeedsGrownUp } from "@/components/family/FamilyShell";
import { deletionBlockers } from "@/lib/account/privacy";
import { signedInAccount } from "@/lib/account/server";
import { authConfigured } from "@/lib/auth/supabase";
import { familyPage } from "@/lib/family/page-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account settings | Readli" };

export default async function AccountPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind === "child") return <NeedsGrownUp text="Only a grown-up can change account settings." />;
  const account = await signedInAccount();
  if (!account) {
    return (
      <FamilyShell>
        <h1 className="font-display text-4xl font-semibold">Account settings</h1>
        <p className="text-lg">Log in to your own family to change your name, download your data or delete your account.</p>
        {authConfigured() && (
          <Link href="/login?next=/family/account" className={`${buttonPrimary} self-start`}>
            Log in
          </Link>
        )}
      </FamilyShell>
    );
  }
  const { db, user } = account;
  const profile = await db.from("adult_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  const name = (profile.data?.display_name as string | undefined) ?? user.name;
  return (
    <FamilyShell>
      <div>
        <Link href="/family" className="font-semibold underline underline-offset-4">
          Back to your family
        </Link>
        <h1 className="mt-2 font-display text-4xl font-semibold">Account settings</h1>
      </div>
      <AccountSettings name={name} email={user.email} blockers={await deletionBlockers(db, user.id)} />
    </FamilyShell>
  );
}
