import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { signInWithOtp: vi.fn(), verifyOtp: vi.fn(), signInWithOAuth: vi.fn() };
vi.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ auth }) }));
vi.mock("@/lib/marketing/meta-pixel", () => ({ trackMeta: vi.fn() }));

import { LoginForm } from "./LoginForm";

const assign = vi.fn();
let calls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify(url === "/auth/finish" ? { next: "/voice/record" } : {}), { status: 200 });
    }),
  );
  Object.defineProperty(window, "location", { value: { ...window.location, origin: "https://preview.example", assign }, writable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function sendCodeTo(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  await screen.findByTestId("code-step");
}

describe("LoginForm", () => {
  it("signs in with the emailed code on the same page, saves the optional name, then goes on", async () => {
    render(<LoginForm next="/voice/record" askName askMarketing />);
    fireEvent.change(screen.getByLabelText(/What should we call you/), { target: { value: "Grandpa Kevin" } });
    await sendCodeTo("kevin@example.com");
    // The email still carries a link back to this preview, as a fallback.
    expect(auth.signInWithOtp.mock.calls[0]![0].options.emailRedirectTo).toMatch(/^https:\/\/preview\.example\/auth\/callback\?next=%2Fvoice%2Frecord/);

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "123 456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/voice/record"));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "kevin@example.com", token: "123456", type: "email" });
    expect(calls.map((c) => c.url)).toEqual(["/auth/finish", "/api/account"]);
    expect(calls[0]!.body).toMatchObject({ next: "/voice/record", news: false });
    expect(calls[1]!.body).toEqual({ displayName: "Grandpa Kevin" });
  });

  it("keeps the code step open with a message when the code is wrong", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { status: 403, message: "Token has expired or is invalid" } });
    render(<LoginForm next="/family" />);
    await sendCodeTo("sara@example.com");
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "That code didn't work. Check it, or send a new one.");
    expect(assign).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("carries on in place when the page asks to, with a retry if that step fails", async () => {
    const onSignedIn = vi.fn().mockRejectedValueOnce(new Error("Checkout couldn't start. Please try again.")).mockResolvedValueOnce(undefined);
    render(<LoginForm next="/signup/family" onSignedIn={onSignedIn} submitLabel="Email me a code" />);
    await sendCodeTo("sara@example.com");
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Checkout couldn't start. Please try again.");
    expect(assign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(2));
  });
});
