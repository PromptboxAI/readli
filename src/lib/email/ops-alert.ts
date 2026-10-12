import type { SupabaseClient } from "@supabase/supabase-js";
import { adminEmails } from "@/lib/admin/emails";
import { queueEmails } from "./outbox";

/**
 * Emails Readli's admins about a background job that needs attention (for example, demo cleanup that
 * failed or fell behind the 48-hour promise). At most one email per alert key per day, sent by the
 * outbox worker with the rest of Readli's email.
 */
export async function queueOpsAlert(db: SupabaseClient, alert: { key: string; subject: string; body: string; at?: Date }): Promise<void> {
  const day = (alert.at ?? new Date()).toISOString().slice(0, 10);
  await queueEmails(
    db,
    adminEmails().map((email) => ({
      dedupeKey: `ops_alert:${alert.key}:${day}:${email}`,
      template: "ops_alert" as const,
      subject: alert.subject,
      body: alert.body,
      to: { email },
    })),
  );
}
