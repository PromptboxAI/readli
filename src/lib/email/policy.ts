/**
 * Send-time rules for automated email that aren't about one person's consent: how often optional email
 * may go out, and the hours it may arrive. Transactional email skips both.
 */

/** At most this many relationship or commercial emails per person. */
export const FREQUENCY = { perDay: 1, perWeek: 3 } as const;

/** Optional email arrives between 9am and 7pm in the person's time zone. */
export const SEND_HOURS = { start: 9, end: 19 } as const;

export const DEFAULT_TIME_ZONE = "America/New_York";

export const MAX_ATTEMPTS = 6;

/** Minutes to wait before attempt n+1. */
export const backoffMinutes = (attempts: number) => Math.min(24 * 60, 5 * 2 ** attempts);

export function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function localHour(at: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(at);
  return Number(h);
}

/** Now, if it's within send hours where the person is; otherwise the start of the next window. */
export function sendWindow(now: Date, timeZone: string | null | undefined): Date {
  const tz = validTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const inWindow = (at: Date) => {
    const h = localHour(at, tz);
    return h >= SEND_HOURS.start && h < SEND_HOURS.end;
  };
  if (inWindow(now)) return now;
  // Step to the next quarter hour, then forward in quarter hours: works for half-hour offsets and DST.
  const step = 15 * 60_000;
  let at = new Date(Math.ceil(now.getTime() / step) * step);
  for (let i = 0; i < 4 * 26 && !inWindow(at); i++) at = new Date(at.getTime() + step);
  return at;
}

/**
 * Whether one more optional email may go out now, given when this person's earlier optional emails
 * were sent; if not, the earliest time it could.
 */
export function frequencyAllows(sentAt: Date[], now: Date): { ok: true } | { ok: false; retryAt: Date } {
  const day = 86_400_000;
  const lastDay = sentAt.filter((d) => now.getTime() - d.getTime() < day).sort((a, b) => a.getTime() - b.getTime());
  const lastWeek = sentAt.filter((d) => now.getTime() - d.getTime() < 7 * day).sort((a, b) => a.getTime() - b.getTime());
  const waits: number[] = [];
  if (lastDay.length >= FREQUENCY.perDay) waits.push(lastDay[lastDay.length - FREQUENCY.perDay]!.getTime() + day);
  if (lastWeek.length >= FREQUENCY.perWeek) waits.push(lastWeek[lastWeek.length - FREQUENCY.perWeek]!.getTime() + 7 * day);
  return waits.length ? { ok: false, retryAt: new Date(Math.max(...waits)) } : { ok: true };
}
