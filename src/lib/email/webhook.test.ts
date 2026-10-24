import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyResendSignature } from "./webhook";

const SECRET = `whsec_${Buffer.from("resend-test-key").toString("base64")}`;
const sign = (id: string, ts: string, body: string) => `v1,${createHmac("sha256", Buffer.from("resend-test-key")).update(`${id}.${ts}.${body}`).digest("base64")}`;

describe("Resend webhook signature", () => {
  const now = 1_790_000_000_000;
  const ts = String(now / 1000);
  it("accepts a fresh, correctly signed event", () => {
    expect(verifyResendSignature("{}", { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, "{}") }, SECRET, now)).toBe(true);
  });
  it("rejects a changed body, a stale timestamp or a missing header", () => {
    expect(verifyResendSignature('{"x":1}', { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, "{}") }, SECRET, now)).toBe(false);
    expect(verifyResendSignature("{}", { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, "{}") }, SECRET, now + 600_000)).toBe(false);
    expect(verifyResendSignature("{}", { id: null, timestamp: ts, signature: sign("msg_1", ts, "{}") }, SECRET, now)).toBe(false);
  });
});
