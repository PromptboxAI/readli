import { describe, expect, it, vi } from "vitest";
import { gaClientId, sendGaServerEvent } from "./ga-measurement";

const req = (cookie: string, gpc = false) => new Request("https://readli.ai/auth/callback", { headers: { cookie, ...(gpc ? { "sec-gpc": "1" } : {}) } });
const PROD = { GA_API_SECRET: "s3cret", VERCEL_ENV: "production" };

describe("GA Measurement Protocol", () => {
  it("reads GA's client id from the _ga cookie", () => {
    expect(gaClientId(req("a=1; _ga=GA1.1.123456789.1700000000"))).toBe("123456789.1700000000");
    expect(gaClientId(req("_ga=junk"))).toBeNull();
    expect(gaClientId(req(""))).toBeNull();
  });

  it("sends sign_up with only the client id and the account type", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await sendGaServerEvent(req("_ga=GA1.1.1.2"), "sign_up", { method: "family" }, PROD, fetchImpl as never)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("measurement_id=G-00275HX219");
    expect(JSON.parse(init.body as string)).toEqual({ client_id: "1.2", non_personalized_ads: true, events: [{ name: "sign_up", params: { method: "family" } }] });
  });

  it("sends nothing without the secret, outside production, after an opt-out, or without a GA session", async () => {
    const fetchImpl = vi.fn();
    const cases: [Request, Record<string, string>][] = [
      [req("_ga=GA1.1.1.2"), { VERCEL_ENV: "production" }],
      [req("_ga=GA1.1.1.2"), { ...PROD, VERCEL_ENV: "preview" }],
      [req("_ga=GA1.1.1.2; readli_ads_opt_out=1"), PROD],
      [req("_ga=GA1.1.1.2", true), PROD],
      [req(""), PROD],
    ];
    for (const [r, env] of cases) expect(await sendGaServerEvent(r, "sign_up", {}, env, fetchImpl as never)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
