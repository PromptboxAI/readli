import { READLI_TIME_ZONE } from "@/lib/time";

/** Admin dates and times, in Readli's time zone (Eastern) rather than the server's UTC. */
const ADMIN_TIME_ZONE = READLI_TIME_ZONE;

/** "Nov 2, 11:45 AM EST" */
export function adminDateTime(iso: string, withYear = false): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: ADMIN_TIME_ZONE,
  });
}

/** "Nov 2, 2026", or "Nov 2" without the year. */
export function adminDate(iso: string, withYear = true): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: ADMIN_TIME_ZONE });
}
