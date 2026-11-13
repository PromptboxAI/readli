import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { signInWithOtp: vi.fn(async () => ({ error: null })), verifyOtp: vi.fn(), signInWithOAuth: vi.fn() };
vi.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ auth }) }));
const trackMeta = vi.fn();
vi.mock("@/lib/marketing/meta-pixel", () => ({ trackMeta: (...a: unknown[]) => trackMeta(...a), trackMetaCustom: vi.fn(), rememberCheckout: vi.fn(), newMetaEventId: () => null }));

import { FamilyStart } from "./FamilyStart";

const assign = vi.fn();
let calls: { url: string; body: unknown }[] = [];
let signup: Record<string, unknown> = { signedIn: true };
const props = { monthlyCents: 1999, annualCents: 17999, monthlyCredits: 40, initial: "monthly" as const, paymentsOn: true, autoStart: false, carry: "from=try" };

beforeEach(() => {
  calls = [];
  signup = { signedIn: true };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/signup/family") return new Response(JSON.stringify(signup), { status: 200 });
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
    expect(screen.getByTestId("price-monthly").textContent).toBe("$19.99 a month");
    expect(screen.getByTestId("price-annual").textContent).toBe("$179.99 a year");
    fireEvent.click(screen.getByLabelText(/Yearly/));
    fireEvent.click(screen.getByTestId("family-checkout"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/test_123"));
    expect(calls).toEqual([
      { url: "/api/family/household", body: { provisional: true } },
      { url: "/api/billing/checkout", body: { item: "family_annual", from: "signup" } },
    ]);
    expect(trackMeta).toHaveBeenCalledWith("InitiateCheckout", { value: 179.99, currency: "USD", content_name: "family_annual" }, null);
  });

  it("takes a new email straight to checkout, with no code", async () => {
    render(<FamilyStart {...props} signedInAs={null} />);
    expect(screen.queryByTestId("family-checkout")).toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " New@Example.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to checkout" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/test_123"));
    expect(calls.map((c) => c.url)).toEqual(["/api/signup/family", "/api/family/household", "/api/billing/checkout"]);
    expect(calls[0]!.body).toMatchObject({ email: "New@Example.com", news: false });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("asks for the emailed code when the email already has an account, before any checkout", async () => {
    signup = { existing: true };
    render(<FamilyStart {...props} signedInAs={null} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "kevin@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to checkout" }));
    await screen.findByTestId("code-step");
    expect(screen.getByRole("status").textContent).toMatch(/already have a Readli account/);
    expect(auth.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.url)).toEqual(["/api/signup/family"]);
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows why when the account can't be made", async () => {
    signup = { error: { message: "Too many tries. Please wait a few minutes and try again." } };
    vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify(signup), { status: 429 }));
    render(<FamilyStart {...props} signedInAs={null} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "kevin@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to checkout" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Too many tries/);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
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
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/home?start=1"));
    expect(calls).toEqual([]);
  });
});
