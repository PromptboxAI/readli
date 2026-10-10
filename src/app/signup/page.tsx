import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { PlanList } from "@/components/accounts/PlanList";
import { AdultPage } from "@/components/invites/AdultPage";
import { ACCOUNT_TYPES, signupPath, signupStart } from "@/lib/accounts/accounts";
import { DEFAULT_PLAN, money } from "@/lib/entitlements/config";

export const metadata: Metadata = { title: "Join Readli" };

/** Two entry points only. Readli Kids is the child side of Readli Family, never its own account. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const invite = typeof p.invite === "string" ? p.invite : null;
  if (invite) redirect(signupPath(signupStart({ invitation: invite, signedIn: false })));
  const { family, voice } = ACCOUNT_TYPES;
  return (
    <AdultPage wide>
      <header className="flex flex-col items-center gap-3 text-center">
        <ReadiMascot size={120} decorative />
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">How would you like to join?</h1>
        <p className="max-w-xl text-lg">Start a family library for your kids, or share your voice with a family that loves you.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2" data-testid="signup-options">
        <section aria-labelledby="opt-family" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/60 p-6 ring-2 ring-ink/10 sm:p-8">
          <div>
            <h2 id="opt-family" className="font-display text-3xl font-semibold">
              {family.cta}
            </h2>
            <p className="mt-1 font-display text-2xl">
              {money(DEFAULT_PLAN.familyMonthlyPriceCents)}
              <span className="text-lg text-muted">/month</span>
            </p>
            <p className="mt-1">{family.name}: classic stories read by the people your kids love.</p>
          </div>
          <PlanList items={family.includes} />
          <Link href="/signup/family" className={`${buttonPrimary} mt-auto w-full`}>
            {family.cta}
          </Link>
        </section>
        <section aria-labelledby="opt-voice" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-mint/50 p-6 ring-2 ring-ink/10 sm:p-8">
          <div>
            <h2 id="opt-voice" className="font-display text-3xl font-semibold">
              {voice.cta}
            </h2>
            <p className="mt-1 font-display text-2xl">Free</p>
            <p className="mt-1">{voice.name}: for grandparents, aunts, uncles and friends who read to a family&apos;s kids.</p>
          </div>
          <PlanList items={voice.includes} />
          <Link href="/signup/voice" className={`${buttonSecondary} mt-auto w-full`}>
            {voice.cta}
          </Link>
        </section>
      </div>
      <p className="text-center">
        Kids listen in Readli Kids, inside a family&apos;s account. They never need their own login.{" "}
        <Link href="/login" className="font-semibold underline underline-offset-4">
          Already have Readli? Log in
        </Link>
      </p>
    </AdultPage>
  );
}
