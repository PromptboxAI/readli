import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sameHash } from "@/lib/server/guest-token";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { demoFamilyState } from "./demo-family";
import type { Actor } from "./model";
import { MemoryFamilyStore, type FamilyStore } from "./service";

/**
 * Who is asking. Until family accounts ship (Phase 4, Supabase Auth with email and Google), the
 * family preview uses a signed demo cookie and an in-memory household. It is on in local dev and
 * tests, and off in production unless FAMILY_DEMO=1. Each visitor gets their own copy of the
 * household (a sandbox), so nobody's changes leak into anyone else's preview. The service layer only
 * sees an Actor and a store, so real sign-in replaces this file without touching the permission checks.
 */
export const FAMILY_COOKIE = "readli_family_demo";

export function familyPreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FAMILY_DEMO === "1" || env.VOICE_PROVIDER === "stub" || env.NODE_ENV !== "production";
}

function secret(): string {
  return process.env.GUEST_COOKIE_SECRET ?? "readli-dev-only-secret";
}

export interface FamilySession {
  sandbox: string;
  actor: Actor;
}

export function encodeSession({ sandbox, actor }: FamilySession, key = secret()): string {
  const who = actor.kind === "adult" ? `adult:${actor.adultId}` : `child:${actor.childId}`;
  const body = `${sandbox}~${who}`;
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

export function decodeSession(value: string | undefined, key = secret()): FamilySession | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  if (!sameHash(value.slice(dot + 1), createHmac("sha256", key).update(body).digest("base64url"))) return null;
  const [sandbox, who] = body.split("~");
  const [kind, id] = (who ?? "").split(":");
  if (!sandbox || !id) return null;
  if (kind === "adult") return { sandbox, actor: { kind: "adult", adultId: id } };
  if (kind === "child") return { sandbox, actor: { kind: "child", childId: id } };
  return null;
}

export async function currentSession(): Promise<FamilySession | null> {
  return decodeSession((await cookies()).get(FAMILY_COOKIE)?.value);
}

export async function setSession(session: FamilySession | null): Promise<void> {
  const jar = await cookies();
  if (!session) {
    jar.delete(FAMILY_COOKIE);
    return;
  }
  jar.set(FAMILY_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function newSandbox(): string {
  return randomBytes(12).toString("base64url");
}

const MAX_SANDBOXES = 500;
const g = globalThis as typeof globalThis & {
  __readliFamily?: { sandboxes: Map<string, MemoryFamilyStore>; provider: StubVoiceProvider };
};

/** The store for one preview sandbox, created from the demo household on first use. */
export function familyStore(sandbox: string): FamilyStore | null {
  if (!familyPreviewEnabled()) return null;
  g.__readliFamily ??= { sandboxes: new Map(), provider: new StubVoiceProvider() };
  const { sandboxes } = g.__readliFamily;
  let store = sandboxes.get(sandbox);
  if (!store) {
    if (sandboxes.size >= MAX_SANDBOXES) sandboxes.delete(sandboxes.keys().next().value!);
    store = new MemoryFamilyStore(demoFamilyState());
    sandboxes.set(sandbox, store);
  }
  return store;
}

export function familyProvider(): StubVoiceProvider {
  g.__readliFamily ??= { sandboxes: new Map(), provider: new StubVoiceProvider() };
  return g.__readliFamily.provider;
}

export function resetSandbox(sandbox: string): void {
  g.__readliFamily?.sandboxes.delete(sandbox);
}
