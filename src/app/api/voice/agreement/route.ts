import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { acceptVoiceAgreement, setThirdPartyLicensing, VoiceAgreementError, withdrawTrainingRights } from "@/lib/voice/agreements";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";

const VOICES_OFF = "Readli voices aren't switched on here yet.";
const SIGN_IN = "Please sign in to make your Readli voice.";

async function context() {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return { error: fail(503, "voices_off", VOICES_OFF) };
  const owner = await voiceOwner(SIGN_IN);
  if ("error" in owner) return { error: owner.error };
  const user = owner.user;
  return { deps, contributor: { id: user.id, name: user.name, email: user.email } };
}

function handle(err: unknown) {
  if (err instanceof VoiceAgreementError) return fail(err.status, err.code, err.userMessage);
  throw err;
}

/** The grown-up's Voice Recording Agreement history, newest first. */
export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const history = await ctx.deps.agreements.history(ctx.contributor.id);
  return NextResponse.json({ current: history[0] ?? null, history }, { headers: { "cache-control": "no-store" } });
}

/** Accepts the agreement before the microphone starts. Body: { statements: string[], thirdPartyLicensing: boolean }. */
export async function POST(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => null)) as { statements?: unknown; thirdPartyLicensing?: unknown } | null;
  const statements = Array.isArray(body?.statements) ? body.statements.filter((s): s is string => typeof s === "string") : [];
  try {
    const agreement = await acceptVoiceAgreement(ctx.deps.agreements, ctx.contributor, {
      statements,
      thirdPartyLicensing: body?.thirdPartyLicensing === true,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
    return NextResponse.json({ agreement }, { status: 201 });
  } catch (err) {
    return handle(err);
  }
}

/**
 * Changes optional permissions. Body: { thirdPartyLicensing: boolean } turns licensing to other
 * companies on or off; { aiTraining: false } withdraws all AI-training permission (Readli development
 * and licensing) without deleting recordings or changing family sharing.
 */
export async function PATCH(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => null)) as { thirdPartyLicensing?: unknown; aiTraining?: unknown } | null;
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  if (body?.aiTraining === false) {
    try {
      return NextResponse.json({ agreement: await withdrawTrainingRights(ctx.deps.agreements, ctx.contributor, ua) });
    } catch (err) {
      return handle(err);
    }
  }
  if (typeof body?.thirdPartyLicensing !== "boolean") return fail(400, "bad_request", "Please choose on or off.");
  try {
    const agreement = await setThirdPartyLicensing(ctx.deps.agreements, ctx.contributor, body.thirdPartyLicensing, ua);
    return NextResponse.json({ agreement });
  } catch (err) {
    return handle(err);
  }
}
