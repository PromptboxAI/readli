import Link from "next/link";
import type { SupportEmail } from "@/lib/admin/problems";
import { adminDateTime } from "@/lib/admin/time";

const EMAIL_STATUS: Record<string, string> = { queued: "Waiting to send", sending: "Sending", sent: "Sent", failed: "Failed", suppressed: "Not sent (unsubscribed or bounced before)", canceled: "Canceled" };

export function SupportEmails({ emails, people }: { emails: SupportEmail[]; people: { id: string; name: string }[] }) {
  return (
    <section id="emails" className="flex scroll-mt-6 flex-col gap-2" aria-labelledby="emails-h">
      <h2 id="emails-h" className="font-display text-2xl font-semibold">
        Emails
      </h2>
      <p className="text-sm">
        Readli&apos;s own emails to this family or person, newest first. Sign-in emails come from Supabase and aren&apos;t listed. Retry a failed one on{" "}
        <Link href="/admin/email" className="underline underline-offset-4">
          Email
        </Link>
        .
      </p>
      {emails.length === 0 ? (
        <p className="text-muted">None recorded.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm" data-testid="family-emails">
          {emails.map((e, i) => {
            const to = people.find((p) => p.id === e.to);
            return (
              <li key={`${e.at}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="whitespace-nowrap text-muted">{adminDateTime(e.at)}</span>
                <strong>{e.subject}</strong>
                {to && <span>to {to.name}</span>}
                <span className={e.status === "failed" ? "text-coral-deep" : ""}>
                  {EMAIL_STATUS[e.status] ?? e.status}
                  {e.lastEvent && e.status === "sent" ? ` (${e.lastEvent.replace(/^email\./, "").replaceAll("_", " ")})` : ""}
                  {e.error ? `: ${e.error}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
