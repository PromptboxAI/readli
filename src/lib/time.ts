/**
 * Every date and time Readli shows is in Eastern time, whatever the server's or browser's clock says
 * (Kevin, 2026-11-02). The servers run on UTC, so formatting without a time zone showed UTC.
 * Calendar dates stored without a time (an event day, a guide's date) are formatted as UTC noon
 * instead, so they never move a day.
 */
export const READLI_TIME_ZONE = "America/New_York";
