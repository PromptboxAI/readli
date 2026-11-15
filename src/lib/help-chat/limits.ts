import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Guard rails for the help chatbot (Kevin, 2026-11-15): short messages, short chats, a signed
 * token the widget must fetch first, and a daily spending cap. Burst limits per address use
 * src/lib/server/rate-limit.ts in the route.
 */

export const MAX_USER_TURNS = 10;
export const MAX_USER_CHARS = 1000;
const MAX_ASSISTANT_CHARS = 6000;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function parseChat(raw: unknown): { ok: true; messages: ChatTurn[] } | { ok: false; message: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, message: "Please type a question." };
  if (raw.length > MAX_USER_TURNS * 2 - 1)
    return { ok: false, message: "This chat is getting long. Please start a new one, or use Talk to a person." };
  const messages: ChatTurn[] = [];
  for (const [i, m] of raw.entries()) {
    const role = i % 2 === 0 ? "user" : "assistant";
    if (!m || typeof m !== "object" || (m as ChatTurn).role !== role || typeof (m as ChatTurn).content !== "string")
      return { ok: false, message: "Something went wrong. Please start a new chat." };
    const content = (m as ChatTurn).content.trim();
    if (!content) return { ok: false, message: "Please type a question." };
    if (role === "user" && content.length > MAX_USER_CHARS)
      return { ok: false, message: `Please keep questions under ${MAX_USER_CHARS} characters.` };
    messages.push({ role, content: content.slice(0, MAX_ASSISTANT_CHARS) });
  }
  if (messages.at(-1)?.role !== "user") return { ok: false, message: "Please type a question." };
  return { ok: true, messages };
}

/** Tokens are valid from MIN_AGE after the widget opens (bots that post straight away fail) until MAX_AGE. */
const MIN_AGE_MS = 1_500;
const MAX_AGE_MS = 3 * 60 * 60_000;

const mac = (secret: string, ts: string) => createHmac("sha256", `readli-help-chat:${secret}`).update(ts).digest("base64url");

export function signChatToken(secret: string, now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${mac(secret, ts)}`;
}

export function verifyChatToken(secret: string, token: unknown, now = Date.now()): "ok" | "too_soon" | "bad" {
  if (typeof token !== "string") return "bad";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return "bad";
  const want = Buffer.from(mac(secret, ts));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return "bad";
  const age = now - Number(ts);
  if (age < 0 || age > MAX_AGE_MS) return "bad";
  return age < MIN_AGE_MS ? "too_soon" : "ok";
}

/** Claude Opus 5.5 list prices in US dollars per million tokens (5-minute cache writes cost 1.25x input). */
const RATES = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** What one reply cost. A fallback model costs no more than this, so it's a safe upper bound. */
export function replyUsd(u: Usage): number {
  return (
    (u.input_tokens * RATES.input +
      (u.cache_creation_input_tokens ?? 0) * RATES.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * RATES.cacheRead +
      u.output_tokens * RATES.output) /
    1_000_000
  );
}

export function dailyCapUsd(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.HELP_CHAT_DAILY_USD);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** The day spending is counted against, in UTC. */
export const usageDay = (now = new Date()) => now.toISOString().slice(0, 10);

const g = globalThis as typeof globalThis & { __readliHelpChatSpend?: { day: string; usd: number } };

/**
 * Today's spend so far. Uses the help_chat_usage table when it exists, so every server instance
 * shares one cap; until the migration runs, each instance keeps its own count in memory.
 */
export async function spentToday(db: SupabaseClient | null, now = new Date()): Promise<number> {
  const day = usageDay(now);
  if (db) {
    const { data, error } = await db.from("help_chat_usage").select("usd").eq("day", day).maybeSingle();
    if (!error) return Number((data as { usd?: number | string } | null)?.usd ?? 0);
  }
  const mem = g.__readliHelpChatSpend;
  return mem?.day === day ? mem.usd : 0;
}

export async function recordSpend(db: SupabaseClient | null, usd: number, now = new Date()): Promise<void> {
  const day = usageDay(now);
  const mem = g.__readliHelpChatSpend;
  g.__readliHelpChatSpend = { day, usd: (mem?.day === day ? mem.usd : 0) + usd };
  if (db) await db.rpc("add_help_chat_usage", { p_day: day, p_usd: usd });
}
