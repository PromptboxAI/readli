import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ auth: {} }) }));
const trackMeta = vi.fn();
vi.mock("@/lib/marketing/meta-pixel", () => ({ trackMeta: (...a: unknown[]) => trackMeta(...a), rememberCheckout: vi.fn(), newMetaEventId: () => null }));

import { FamilyStart } from "./FamilyStart";

const assign = vi.fn();
let calls: { url: string; body: unknown }[] = [];
const props = { monthlyCents: 1999, annualCents: 17999, monthlyCredits: 40, initial: "monthly" as const, paymentsOn: true, autoStart: false, carry: "from=try" };

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      const json = url === "/api/billing/checkout" ? { url: "https://checkout.stripe.com/c/test_123" } : { householdId: "h1" };
      return new Response(JSON.stringify(json), { status: url === "/api/billing/checkout" ? 200 : 201 });
    }),
  );
  Object.defineProperty(window, "location", { value: { ...window.location, origin: "https://preview.example", assign }, writable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FamilyStart", () => {
  it("shows the prices first, then takes a signed-in Voice account straight to the chosen plan's checkout", async () => {
    render(<FamilyStart {...props} signedInAs="kevin@example.com" />);
    expect(screen.getByTestId("price-monthly").textContent).toBe("$19.99/month");
    expect(screen.getByTestId("price-annual").textContent).toBe("$179.99/year");
    fireEvent.click(screen.getByLabelText(/Yearly/));
    fireEvent.click(screen.getByTestId("family-checkout"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/test_123"));
    expect(calls).toEqual([
      { url: "/api/family/household", body: { provisional: true } },
      { url: "/api/billing/checkout", body: { item: "family_annual", from: "signup" } },
    ]);
    expect(trackMeta).toHaveBeenCalledWith("InitiateCheckout", { value: 179.99, currency: "USD", content_name: "family_annual" }, null);
  });

  it("asks for the emailed code when signed out, before any checkout", () => {
    render(<FamilyStart {...props} signedInAs={null} />);
    expect(screen.getByRole("button", { name: "Email me a code" })).toBeTruthy();
    expect(screen.queryByTestId("family-checkout")).toBeNull();
  });

  it("goes on to checkout by itself when back from Google with a plan chosen", async () => {
    render(<FamilyStart {...props} initial="annual" signedInAs="kevin@example.com" autoStart />);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/test_123"));
    expect(calls[1]).toEqual({ url: "/api/billing/checkout", body: { item: "family_annual", from: "signup" } });
  });

  it("starts the family without checkout while payments are off", async () => {
    render(<FamilyStart {...props} paymentsOn={false} signedInAs="kevin@example.com" />);
    expect(screen.getByTestId("checkout-off")).toBeTruthy();
    fireEvent.click(screen.getByTestId("family-checkout"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/family?start=1"));
    expect(calls).toEqual([]);
  });
});
