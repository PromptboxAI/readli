import type { Metadata } from "next";
import { buttonQuiet } from "@/components/brand/buttons";
import { Composer } from "./Composer";
import { DesignFrame } from "./DesignFrame";

export const metadata: Metadata = { title: "Design: Invite your family | Readli", robots: { index: false } };

type Status = "Pending" | "Opened" | "Accepted" | "Expired" | "Declined";
const STATUS_STYLE: Record<Status, string> = {
  Pending: "bg-sunshine/70",
  Opened: "bg-sky/70",
  Accepted: "bg-mint",
  Expired: "bg-ink/10",
  Declined: "bg-coral/30",
};
const SENT: { name: string; email: string; status: Status; detail: string; actions: string[] }[] = [
  { name: "Sara", email: "sara@example.com", status: "Accepted", detail: "Started a Family trial on Oct 3. Your voice is waiting for her approval.", actions: [] },
  { name: "Priya", email: "priya@example.com", status: "Opened", detail: "Visited your preview page on Oct 9.", actions: ["Resend", "Revoke"] },
  { name: "Daniel", email: "dan@example.com", status: "Pending", detail: "Sent Oct 10. Link expires Oct 24.", actions: ["Resend", "Revoke"] },
  { name: "Aunt Rosa", email: "rosa@example.com", status: "Expired", detail: "Expired Sep 30 without a visit.", actions: ["Send a new link"] },
  { name: "Mike", email: "mike@example.com", status: "Declined", detail: "Mike said no thanks. We won't email him again.", actions: [] },
];

/** Contributor dashboard: Invite Your Family composer and invitation management. */
export default function InviteYourFamilyDesign() {
  return (
    <DesignFrame current="/design/invitations">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-2">
          <p className="font-display text-lg font-semibold text-coral-deep">Readli Voice · Hi, Grandma June</p>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Invite your family</h1>
          <p className="max-w-2xl text-lg">
            Send your family a short preview of your voice reading a story. They can listen right away, no account needed, and start a free Readli
            Family trial to hear you read every night.
          </p>
        </header>

        <Composer />

        <section aria-labelledby="sent-h" className="flex flex-col gap-4" data-testid="invite-dashboard">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="sent-h" className="font-display text-3xl font-semibold">
              Your invitations
            </h2>
            <p className="text-sm text-muted">5 sent · 1 family joined</p>
          </div>
          <ul className="flex flex-col gap-3">
            {SENT.map((s) => (
              <li key={s.email} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold">{s.name}</span>
                    <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                  </div>
                  <span className="truncate text-sm text-muted">{s.email}</span>
                  <span className="text-sm">{s.detail}</span>
                </div>
                {s.actions.length > 0 && (
                  <div className="flex gap-2">
                    {s.actions.map((a) => (
                      <button key={a} type="button" className={`${buttonQuiet} min-h-11 border-2 border-ink/20 px-4 text-base`}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            &ldquo;Opened&rdquo; means someone visited your preview page from the link. We don&apos;t use email tracking pixels, which can&apos;t tell a
            person from a mail app. Resend works once a day per person, up to 3 times.
          </p>
        </section>
      </main>
    </DesignFrame>
  );
}
