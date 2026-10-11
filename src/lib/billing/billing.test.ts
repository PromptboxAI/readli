// @vitest-environment node
import { describe, expect, it } from "vitest";
import { billingConfig, paymentsOn } from "./config";
import { signStripePayload, verifyStripeSignature } from "./stripe-signature";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const keys = { STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_123" };

describe("billingConfig", () => {
  it("is off by default, even with keys", () => {
    expect(billingConfig(env({}))).toEqual({ provider: "stripe", mode: "off", offReason: "switched_off" });
    expect(billingConfig(env(keys)).mode).toBe("off");
    expect(paymentsOn(billingConfig(env({})))).toBe(false);
  });

  it("needs both keys once switched on", () => {
    expect(billingConfig(env({ PAYMENTS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_abc" })).offReason).toBe("missing_keys");
  });

  it("runs in test mode with a test key", () => {
    const c = billingConfig(env({ PAYMENTS_ENABLED: "true", ...keys }));
    expect(c.mode).toBe("test");
    expect(paymentsOn(c)).toBe(true);
    expect(billingConfig(env({ PAYMENTS_ENABLED: "true", ...keys, STRIPE_SECRET_KEY: "rk_test_x" })).mode).toBe("test");
  });

  it("refuses a live key unless live is explicitly allowed", () => {
    const live = { PAYMENTS_ENABLED: "true", ...keys, STRIPE_SECRET_KEY: "sk_live_abc" };
    expect(billingConfig(env(live))).toMatchObject({ mode: "off", offReason: "live_not_allowed" });
    expect(billingConfig(env({ ...live, PAYMENTS_LIVE: "true" })).mode).toBe("live");
  });

  it("refuses keys that aren't Stripe secret keys", () => {
    expect(billingConfig(env({ PAYMENTS_ENABLED: "true", ...keys, STRIPE_SECRET_KEY: "pk_test_abc" })).offReason).toBe("unknown_key");
  });
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", livemode: false });
  const now = 1_760_000_000;

  it("accepts a correctly signed payload", () => {
    expect(verifyStripeSignature(body, signStripePayload(body, secret, now), secret, now)).toBe(true);
  });

  it("accepts when any v1 signature matches (secret rotation)", () => {
    const header = `${signStripePayload(body, secret, now)},v1=${"0".repeat(64)}`;
    expect(verifyStripeSignature(body, header, secret, now)).toBe(true);
  });

  it("refuses a tampered body, wrong secret or missing header", () => {
    const header = signStripePayload(body, secret, now);
    expect(verifyStripeSignature(body + " ", header, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, header, "whsec_other", now)).toBe(false);
    expect(verifyStripeSignature(body, null, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, "garbage", secret, now)).toBe(false);
  });

  it("refuses an old delivery (replay)", () => {
    expect(verifyStripeSignature(body, signStripePayload(body, secret, now - 301), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, signStripePayload(body, secret, now - 299), secret, now)).toBe(true);
  });
});
