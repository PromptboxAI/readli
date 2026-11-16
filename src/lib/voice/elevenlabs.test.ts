import { describe, expect, it } from "vitest";
import { ElevenLabsProvider } from "./elevenlabs";
import { VoiceProviderError } from "./provider";

function fakeFetch(addBody: unknown) {
  const calls: string[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.endsWith("/voices/add")) return new Response(JSON.stringify(addBody), { status: 200 });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { calls, impl };
}

const take = { name: "n", audio: new Blob(["x"], { type: "audio/webm" }), filename: "take.webm", description: "d" };

describe("ElevenLabs cloning", () => {
  it("returns the new voice", async () => {
    const f = fakeFetch({ voice_id: "abc", requires_verification: false });
    expect(await new ElevenLabsProvider("key", "m", f.impl).createInstantVoice(take)).toEqual({ voiceId: "abc" });
  });

  it("refuses and deletes a clone held for verification, so nobody is handed a voice that can't read", async () => {
    const f = fakeFetch({ voice_id: "abc", requires_verification: true });
    const err = await new ElevenLabsProvider("key", "m", f.impl).createInstantVoice(take).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VoiceProviderError);
    expect((err as VoiceProviderError).userMessage).toMatch(/record it again/);
    expect(f.calls.some((c) => c.startsWith("DELETE") && c.endsWith("/voices/abc"))).toBe(true);
  });
});
