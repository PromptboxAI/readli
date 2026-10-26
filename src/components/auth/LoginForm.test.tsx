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

function typeCode(code: string) {
  // Pasting into the first box spreads the digits, the way a phone's code suggestion does.
  fireEvent.paste(screen.getByLabelText("Digit 1 of 6"), { clipboardData: { getData: () => code } });
}

async function sendCodeTo(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  await screen.findByTestId("code-step");
}

describe("LoginForm", () => {
  it("signs in with the 6-digit code on the same page, then goes on", async () => {
    render(<LoginForm next="/voice/record" askMarketing />);
    await sendCodeTo("kevin@example.com");
    // The email still carries a link back to this preview, as a fallback.
    expect(auth.signInWithOtp.mock.calls[0]![0].options.emailRedirectTo).toMatch(/^https:\/\/preview\.example\/auth\/callback\?next=%2Fvoice%2Frecord/);

    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    typeCode("123 456");
    // All six filled checks the code without another click.
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/voice/record"));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "kevin@example.com", token: "123456", type: "email" });
    expect(calls.map((c) => c.url)).toEqual(["/auth/finish"]);
    expect(calls[0]!.body).toMatchObject({ next: "/voice/record", news: false });
  });

  it("moves between boxes as digits are typed and deleted", async () => {
    render(<LoginForm next="/family" />);
    await sendCodeTo("sara@example.com");
    const box = (n: number) => screen.getByLabelText(`Digit ${n} of 6`) as HTMLInputElement;
    fireEvent.change(box(1), { target: { value: "4" } });
    expect(document.activeElement).toBe(box(2));
    fireEvent.change(box(2), { target: { value: "2" } });
    fireEvent.keyDown(box(3), { key: "Backspace" });
    expect(box(2).value).toBe("");
    expect(document.activeElement).toBe(box(2));
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("keeps Google sign-in, returning to the same next step and preview", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: null });
    render(<LoginForm next="/voice/record?from=try&next=%2Fvoice%3Fsaved%3D1" askMarketing />);
    // The news opt-in sits below both ways to sign in, unticked.
    const news = screen.getByRole("checkbox") as HTMLInputElement;
    expect(news.checked).toBe(false);
    expect(screen.getByRole("button", { name: "Continue with Google" }).compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email me a code" }).compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled());
    const redirectTo = auth.signInWithOAuth.mock.calls[0]![0].options.redirectTo as string;
    expect(new URL(redirectTo).origin).toBe("https://preview.example");
    expect(new URL(redirectTo).searchParams.get("next")).toBe("/voice/record?from=try&next=%2Fvoice%3Fsaved%3D1");
  });

  it("keeps the code step open with a message when the code is wrong", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { status: 403, message: "Token has expired or is invalid" } });
    render(<LoginForm next="/family" />);
    await sendCodeTo("sara@example.com");
    typeCode("000000");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "That code didn't work. Check it, or send a new one.");
    // The boxes empty so a new code can go straight in.
    expect((screen.getByLabelText("Digit 1 of 6") as HTMLInputElement).value).toBe("");
    expect(assign).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("carries on in place when the page asks to, with a retry if that step fails", async () => {
    const onSignedIn = vi.fn().mockRejectedValueOnce(new Error("Checkout couldn't start. Please try again.")).mockResolvedValueOnce(undefined);
    render(<LoginForm next="/signup/family" onSignedIn={onSignedIn} submitLabel="Email me a code" />);
    await sendCodeTo("sara@example.com");
    typeCode("654321");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Checkout couldn't start. Please try again.");
    expect(assign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(2));
  });
});
