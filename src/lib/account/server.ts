import type { SupabaseClient } from "@supabase/supabase-js";
import { accountDb } from "@/lib/family/account-store";
import { currentSession } from "@/lib/family/session";
import { fail } from "@/lib/server/http";
import { ElevenLabsProvider } from "@/lib/voice/elevenlabs";
import type { VoiceProvider } from "@/lib/voice/provider";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { AccountError } from "./privacy";

export interface SignedInAccount {
  user: { id: string; name: string; email: string | null };
  db: SupabaseClient;
}

/** The grown-up signed in on this device, not a kids profile, with the server's database client. */
export async function signedInAccount(): Promise<SignedInAccount | null> {
  const session = await currentSession();
  if (!session?.account || session.actor.kind !== "adult") return null;
  const db = accountDb();
  return db ? { user: session.account, db } : null;
}

export function voiceProvider(env: NodeJS.ProcessEnv = process.env): VoiceProvider | null {
  if (env.ELEVENLABS_API_KEY) return new ElevenLabsProvider(env.ELEVENLABS_API_KEY, env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2");
  if (env.VOICE_PROVIDER === "stub") return new StubVoiceProvider();
  return null;
}

/** Runs an account route for the signed-in grown-up only. */
export async function withAccount(run: (account: SignedInAccount) => Promise<Response>): Promise<Response> {
  const account = await signedInAccount();
  if (!account) return fail(401, "sign_in_required", "Please sign in as a grown-up to manage your account.");
  try {
    return await run(account);
  } catch (err) {
    if (err instanceof AccountError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}
