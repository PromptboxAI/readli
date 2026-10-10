import { NextResponse } from "next/server";

/** JSON error with a message that is safe to show the guest. */
export function fail(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: { "cache-control": "no-store" } });
}

export const PREVIEWS_OFF = "Voice previews switch on soon.";
export const NO_SESSION = "Your preview session has ended. Record again to hear a story in your voice.";
