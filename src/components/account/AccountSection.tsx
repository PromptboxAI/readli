import Link from "next/link";
import { AccountSettings } from "@/components/account/AccountSettings";
import { ProfileCard } from "@/components/account/ProfileCard";
import { buttonPrimary } from "@/components/brand/buttons";
import { EmailToggles } from "@/components/email/EmailPreferencesForm";
import { photoUrl } from "@/lib/account/photos";
import { deletionBlockers } from "@/lib/account/privacy";
import { signedInAccount } from "@/lib/account/server";
import { authConfigured } from "@/lib/auth/supabase";
import { preferencesFor } from "@/lib/email/preferences";
import type { FamilyState } from "@/lib/family/model";

/** The Account section of Settings: profile, emails, and the grown-up's data. It needs a real sign-in. */
export async function AccountSection({ state }: { state: FamilyState | null }) {
  const account = await signedInAccount();
  if (!account) {
    return (
      <>
        <p className="text-lg">Log in to your own family to change your name or photo, download your data or delete your account.</p>
        {authConfigured() && (
          <Link href="/login?next=/family/settings" className={`${buttonPrimary} self-start`}>
            Log in
          </Link>
        )}
      </>
    );
  }
  const { db, user } = account;
  const profile = await db.from("adult_profiles").select("display_name, avatar_path, photo_consent_at").eq("user_id", user.id).maybeSingle();
  const name = (profile.data?.display_name as string | undefined) ?? user.name;
  const consentAt = (profile.data?.photo_consent_at as string | null | undefined) ?? null;
  const avatarUrl = profile.data?.avatar_path && consentAt ? photoUrl(user.id, consentAt) : null;
  const tint = (state?.adults.find((a) => a.id === user.id)?.tint as string | undefined) ?? "bg-sunshine";
  const [prefs, blockers] = await Promise.all([preferencesFor(db, user.id), deletionBlockers(db, user.id)]);
  return (
    <>
      <ProfileCard name={name} email={user.email} tint={tint} avatarUrl={avatarUrl} />
      <EmailToggles initial={prefs} />
      <AccountSettings blockers={blockers} />
    </>
  );
}
