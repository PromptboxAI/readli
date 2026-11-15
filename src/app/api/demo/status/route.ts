import { NextResponse } from "next/server";
import { demoEmailOn } from "@/lib/email/guest-demo";
import { emailSecret, readliMailer } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { DEMO_BOOKS } from "@/lib/content/demo-books";
import { currentGuest, effectiveMode, guestDemoDeps, previewCounts } from "@/lib/server/guest-demo";
import { previewKey } from "@/lib/server/guest-preview";

export const dynamic = "force-dynamic";

/**
 * Whether voice previews are available, this guest's remaining previews, whether a demo can be emailed,
 * and which stories were already read in the guest's current voice (they replay free), so a reload or
 * Back can mark them.
 */
export async function GET() {
  const deps = guestDemoDeps();
  const mode = await effectiveMode(deps).catch(() => "off" as const);
  const guest = deps && mode !== "off" ? await currentGuest(deps).catch(() => null) : null;
  const demoEmail = mode !== "off" && (await demoEmailOn(accountDb(), Boolean(emailSecret() && readliMailer())));
  const heard = deps && guest?.hasVoice ? await heardStories(deps, guest.id).catch(() => []) : [];
  return NextResponse.json(
    { mode, demoEmail, guest: guest ? { ...previewCounts(guest), hasVoice: guest.hasVoice, expiresAt: guest.expiresAt, heard } : null },
    { headers: { "cache-control": "no-store" } },
  );
}

async function heardStories(deps: NonNullable<ReturnType<typeof guestDemoDeps>>, guestId: string): Promise<string[]> {
  const voiceId = await deps.store.getVoice(guestId);
  if (!voiceId) return [];
  const books = DEMO_BOOKS.filter((b) => b.passageText);
  const kept = new Set(await deps.store.keptPreviews(guestId, books.map((b) => previewKey(voiceId, b.slug))));
  return books.filter((b) => kept.has(previewKey(voiceId, b.slug))).map((b) => b.slug);
}
