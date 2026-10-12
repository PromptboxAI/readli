import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RespondForm } from "@/components/invitations/RespondForm";
import { AdultPage } from "@/components/invites/AdultPage";
import { invitationContext } from "@/lib/invitations/context";
import { invitationIdFromRespondToken } from "@/lib/invitations/server";

export const metadata: Metadata = { title: "Readli invitations", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const TITLES = {
  decline: ["Decline this invitation?", "The person who invited you won't be able to invite you again. We won't tell them why."],
  unsubscribe: ["Stop all Readli invitations?", "Nobody will be able to send a Readli invitation to this email address."],
  report: ["Report this invitation", "Tell us what happened. Reports are private, and this address won't get Readli invitations again."],
} as const;

export default async function RespondPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const a = (await searchParams).action;
  const action = a === "unsubscribe" || a === "report" ? a : "decline";
  const ctx = invitationContext();
  if (!ctx || !invitationIdFromRespondToken(ctx.secret, token)) notFound();
  const [title, text] = TITLES[action];
  return (
    <AdultPage>
      <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="text-lg">{text}</p>
        <RespondForm token={token} action={action} />
      </section>
    </AdultPage>
  );
}
