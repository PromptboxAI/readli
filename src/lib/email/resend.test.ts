// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { backoffMinutes } from "./outbox";
import { emailConfig, ResendSender, suppressionKey, verifyResendSignature } from "./resend";
import { familyInviteEmail, paymentFailedEmail } from "./templates";

const secret = `whsec_${Buffer.from("test-secret-key").toString("base64")}`;
const sign = (id: string, ts: string, body: string) => createHmac("sha256", Buffer.from("test-secret-key")).update(`${id}.${ts}.${body}`).digest("base64");

describe("Resend", () => {
  it("accepts only correctly signed, fresh webhooks", () => {
    const now = 1_800_000_000_000;
    const ts = String(now / 1000);
    const body = '{"type":"email.bounced"}';
    const good = { id: "msg_1", timestamp: ts, signature: `v1,bad v1,${sign("msg_1", ts, body)}` };
    expect(verifyResendSignature(body, good, secret, now)).toBe(true);
    expect(verifyResendSignature(`${body} `, good, secret, now)).toBe(false);
    expect(verifyResendSignature(body, good, secret, now + 600_000)).toBe(false);
    expect(verifyResendSignature(body, { ...good, signature: null }, secret, now)).toBe(false);
  });

  it("sends with an idempotency key and replies to admin@readli.ai, and retries only when Resend is busy", async () => {
    const calls: RequestInit[] = [];
    let status = 200;
    const fake = (async (_url: string, init?: RequestInit) => {
      calls.push(init!);
      return Response.json(status === 200 ? { id: "em_1" } : { name: "x", message: "nope" }, { status });
    }) as typeof fetch;
    const config = emailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "Readli <hello@readli.ai>" } as unknown as NodeJS.ProcessEnv);
    const sender = new ResendSender(config, fake);
    expect(await sender.send({ to: "a@b.co", subject: "s", text: "t" }, "outbox-1")).toEqual({ ok: true, id: "em_1" });
    expect(calls[0]!.headers).toMatchObject({ "idempotency-key": "outbox-1", authorization: "Bearer re_x" });
    expect(JSON.parse(String(calls[0]!.body))).toMatchObject({ reply_to: "admin@readli.ai", to: ["a@b.co"] });
    status = 429;
    expect(await sender.send({ to: "a@b.co", subject: "s", text: "t" }, "outbox-2")).toMatchObject({ ok: false, retry: true });
    status = 422;
    expect(await sender.send({ to: "a@b.co", subject: "s", text: "t" }, "outbox-3")).toMatchObject({ ok: false, retry: false });
    expect(await new ResendSender(emailConfig({} as NodeJS.ProcessEnv), fake).send({ to: "a@b.co", subject: "s", text: "t" }, "k")).toMatchObject({ ok: false, error: "email_off" });
  });

  it("suppresses by a hash of the address, and backs off between attempts", () => {
    expect(suppressionKey(" Jo@Example.com ")).toBe(suppressionKey("jo@example.com"));
    expect(suppressionKey("jo@example.com")).toHaveLength(64);
    expect([1, 2, 3].map(backoffMinutes)).toEqual([10, 20, 40]);
    expect(backoffMinutes(20)).toBe(24 * 60);
  });

  it("writes plain transactional emails with the real dates", () => {
    const invite = familyInviteEmail({ inviterName: "Sara", familyName: "The Riveras", inviteeName: "June", link: "https://readli.ai/i/x", expiresAt: "2026-10-25T00:00:00Z" });
    expect(invite.subject).toBe("Sara invited you to join The Riveras on Readli");
    expect(invite.body).toContain("Sunday, October 25, 2026");
    expect(paymentFailedEmail({ familyName: "Riveras", billingUrl: "u", retryAt: null }).body).not.toContain("try again");
  });
});
