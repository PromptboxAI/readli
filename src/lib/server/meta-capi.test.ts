import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { attributionFrom, attributionFromMetadata, attributionMetadata, capiEnabled, capiPayload, eventIdFrom, sendCapiEvent, stripeConversion } from "./meta-capi";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const browser = (headers: Record<string, string> = {}) =>
  new Request("https://readli.ai/api/guest/clone", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "Safari", referer: "https://readli.ai/try", cookie: "_fbp=fb.1.1.123; _fbc=fb.1.1.abc", ...headers },
  });

describe("Conversions API attribution", () => {
  it("reads IP, browser, page and Meta's cookies from the request", () => {
    expect(attributionFrom(browser())).toEqual({ ip: "203.0.113.9", userAgent: "Safari", fbp: "fb.1.1.123", fbc: "fb.1.1.abc", sourceUrl: "https://readli.ai/try" });
  });

  it("is null for a browser that opted out or sends Global Privacy Control", () => {
    expect(attributionFrom(browser({ cookie: "_fbp=fb.1.1.123; readli_ads_opt_out=1" }))).toBeNull();
    expect(attributionFrom(browser({ "sec-gpc": "1" }))).toBeNull();
  });

  it("survives Stripe metadata, and an opt-out leaves nothing to send later", () => {
    const a = attributionFrom(browser());
    expect(attributionFromMetadata(attributionMetadata(a))).toEqual(a);
    expect(attributionMetadata(null)).toEqual({});
    expect(attributionFromMetadata({ household_id: "h" })).toBeNull();
    expect(attributionMetadata({ userAgent: "x".repeat(900) }).meta_ua).toHaveLength(500);
  });

  it("only accepts plain event ids from the browser", () => {
    expect(eventIdFrom("0b8f2c1e-1111-4111-8111-123456789abc")).toBe("0b8f2c1e-1111-4111-8111-123456789abc");
    expect(eventIdFrom("<script>")).toBeNull();
    expect(eventIdFrom(42)).toBeNull();
  });
});

describe("Conversions API payload", () => {
  it("hashes email and Readli id, and sends the rest as Meta expects", () => {
    const p = capiPayload(
      { name: "CompleteRegistration", eventId: "registration_u1", attribution: { ip: "203.0.113.9", userAgent: "Safari", fbp: "fb.1.1.123" }, email: "  Dana@Example.com ", externalId: "u1", customData: { content_name: "Readli Family" } },
      1_800_000_000_000,
    );
    expect(p).toEqual({
      event_name: "CompleteRegistration",
      event_time: 1_800_000_000,
      event_id: "registration_u1",
      action_source: "website",
      user_data: { em: [sha("dana@example.com")], external_id: [sha("u1")], client_ip_address: "203.0.113.9", client_user_agent: "Safari", fbp: "fb.1.1.123" },
      custom_data: { content_name: "Readli Family" },
    });
    expect(JSON.stringify(p)).not.toContain("Dana");
  });

  it("is off without a token, and off previews unless a Test Events code is set", () => {
    expect(capiEnabled({ VERCEL_ENV: "production" })).toBe(false);
    expect(capiEnabled({ VERCEL_ENV: "production", META_CAPI_TOKEN: "t" })).toBe(true);
    expect(capiEnabled({ VERCEL_ENV: "preview", META_CAPI_TOKEN: "t" })).toBe(false);
    expect(capiEnabled({ VERCEL_ENV: "preview", META_CAPI_TOKEN: "t", META_TEST_EVENT_CODE: "TEST1" })).toBe(true);
  });

  it("posts to the dataset with the test code, and never throws", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const event = { name: "Lead" as const, eventId: "lead-12345678", attribution: {}, customData: { content_name: "Voice demo" } };
    expect(await sendCapiEvent(event, { META_CAPI_TOKEN: "t", META_TEST_EVENT_CODE: "TEST1" }, fetchImpl as never)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v24.0/28060840410257774/events");
    const body = JSON.parse(String(init.body));
    expect(body.test_event_code).toBe("TEST1");
    expect(body.data[0].event_name).toBe("Lead");
    expect(body.data[0].user_data.em).toBeUndefined();
    const broken = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendCapiEvent(event, { META_CAPI_TOKEN: "t", VERCEL_ENV: "production" }, broken as never)).toBe(false);
  });
});

describe("Stripe conversions", () => {
  const completed = (o: Record<string, unknown>) => ({
    type: "checkout.session.completed",
    created: 1_800_000_000,
    data: {
      object: {
        id: "cs_test_1",
        customer_details: { email: "dana@example.com" },
        currency: "usd",
        metadata: { household_id: "h1", adult_id: "u1", item: "family_monthly", meta_ads: "1", meta_ip: "203.0.113.9", meta_fbp: "fb.1.1.123" },
        ...o,
      },
    },
  });

  it("a paid Readli Family checkout is Subscribe, at what Stripe charged, with the thank-you page's event id", () => {
    const e = stripeConversion(completed({ mode: "subscription", payment_status: "paid", status: "complete", amount_total: 1999, subscription: "sub_1" }));
    expect(e).toMatchObject({
      name: "Subscribe",
      eventId: "subscribe_cs_test_1",
      time: 1_800_000_000,
      email: "dana@example.com",
      externalId: "u1",
      attribution: { ip: "203.0.113.9", fbp: "fb.1.1.123" },
      customData: { value: 19.99, currency: "USD", subscription_id: "sub_1", content_name: "family_monthly" },
    });
  });

  it("a free first period would be StartTrial, and a credit pack is Purchase", () => {
    expect(stripeConversion(completed({ mode: "subscription", payment_status: "no_payment_required", status: "complete", amount_total: 0 }))?.name).toBe("StartTrial");
    expect(stripeConversion(completed({ mode: "payment", payment_status: "paid", amount_total: 500, payment_intent: "pi_1" }))).toMatchObject({
      name: "Purchase",
      eventId: "purchase_cs_test_1",
      customData: { value: 5, currency: "USD", order_id: "pi_1" },
    });
  });

  it("sends nothing for opted-out or older checkouts, unpaid ones, or other events", () => {
    expect(stripeConversion(completed({ mode: "subscription", payment_status: "paid", amount_total: 1999, metadata: { household_id: "h1" } }))).toBeNull();
    expect(stripeConversion(completed({ mode: "payment", payment_status: "unpaid", amount_total: 500 }))).toBeNull();
    expect(stripeConversion({ type: "invoice.paid", data: { object: {} } })).toBeNull();
  });
});
