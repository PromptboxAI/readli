import { describe, expect, it } from "vitest";
import { MemoryMailer } from "@/lib/invitations/email";
import { VoiceProviderError, voiceRefusedError } from "./provider";
import { alertVoiceRefused } from "./refused-alert";

describe("refused voices", () => {
  it("tells a refused voice from an ordinary failure", () => {
    expect(voiceRefusedError(new VoiceProviderError('failed: 403 {"detail":{"code":"voice_access_denied"}}', 403))).toBe(true);
    expect(voiceRefusedError(new Error("voice not ready"))).toBe(true);
    expect(voiceRefusedError(new VoiceProviderError("failed: 429 too many requests", 429))).toBe(false);
    expect(voiceRefusedError(new Error("provider down"))).toBe(false);
  });

  it("emails each admin once a day per voice", async () => {
    const mailer = new MemoryMailer();
    const env = { ADMIN_EMAILS: "a@example.com,b@example.com" } as unknown as NodeJS.ProcessEnv;
    const sent = await alertVoiceRefused({ label: "Readli voice v1", key: "v1", where: "narration", error: "403 voice_access_denied" }, env, mailer, new Date("2026-11-16T21:00:00Z"));
    expect(sent).toBe(2);
    expect(mailer.sent.map((m) => m.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(mailer.sent[0]!.text).toContain("Readli voice v1");
    expect(mailer.sent[0]!.idempotencyKey).toBe("voice-refused-v1-2026-11-16-a@example.com");
  });

  it("does nothing without email set up", async () => {
    expect(await alertVoiceRefused({ label: "x", key: "x", where: "sample", error: "e" }, {} as NodeJS.ProcessEnv, null)).toBe(0);
  });
});
