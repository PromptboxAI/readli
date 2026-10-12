import type { SupabaseClient } from "@supabase/supabase-js";
import { accountDb } from "@/lib/family/account-store";
import { currentSession } from "@/lib/family/session";
import { fail } from "@/lib/server/http";
import { DEFAULT_MODEL, ElevenLabsProvider } from "@/lib/voice/elevenlabs";
import type { VoiceProvider } from "@/lib/voice/provider";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { AccountError, type DeletionBilling } from "./privacy";

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
  if (env.ELEVENLABS_API_KEY) return new ElevenLabsProvider(env.ELEVENLABS_API_KEY, env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL);
  if (env.VOICE_PROVIDER === "stub") return new StubVoiceProvider();
  return null;
}

/** Stripe, for stopping a plan renewing when its only member deletes their account. Null while payments are off. */
export function deletionBilling(): DeletionBilling | null {
  const config = billingConfig();
  if (config.mode === "off") return null;
  const stripe = new StripeApi(config);
  const unreachable = (err: unknown): never => {
    if (err instanceof StripeError) {
      throw new AccountError(503, "billing_unreachable", "We couldn't stop your plan renewing just now, so your account hasn't been deleted. Please try again.");
    }
    throw err;
  };
  return {
    async cancel(ref) {
      try {
        const sub = await stripe.subscription(ref);
        // A retried deletion finds it already cancelled. No proration: unused time isn't refunded or credited.
        if (sub.status !== "canceled" && sub.status !== "incomplete_expired") await stripe.cancelSubscription(ref, { prorate: false });
        return { customer: sub.customer };
      } catch (err) {
        return unreachable(err);
      }
    },
  };
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
