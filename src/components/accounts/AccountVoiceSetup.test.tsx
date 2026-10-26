import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/teleprompter/TeleprompterRecorder", () => ({ TeleprompterRecorder: () => <div data-testid="recorder" /> }));

import { VOICE_SAVED } from "@/lib/accounts/voice-signup";
import { AccountVoiceSetup } from "./AccountVoiceSetup";

const assign = vi.fn();
const take = { durationMs: 72_000, expiresAt: "2026-10-27T00:00:00.000Z" };
let calls: string[] = [];
let fromGuestStatus = 200;

beforeEach(() => {
  calls = [];
  fromGuestStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "/api/voice/from-guest") return new Response(JSON.stringify(fromGuestStatus === 410 ? { error: { message: "Your earlier recording isn't here anymore. Please record your voice again." } } : {}), { status: fromGuestStatus });
      if (url.startsWith("/api/voice/sample")) return { ok: true, status: 200, headers: new Headers(), blob: async () => new Blob(["x"]) } as unknown as Response;
      return new Response("{}", { status: 200 });
    }),
  );
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:sample", revokeObjectURL: () => undefined }));
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const agreeToAll = () => {
  for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
};

describe("AccountVoiceSetup from Save My Voice Free", () => {
  it("saves the demo take once they agree, then goes straight to My Voice", async () => {
    render(<AccountVoiceSetup hasVoice={false} next={VOICE_SAVED} guestTake={take} fromTry />);
    expect(screen.getByRole("heading", { name: "Save the voice you just recorded" })).toBeTruthy();
    expect(screen.getByTestId("save-demo-take").textContent).toContain("1:12");
    agreeToAll();
    fireEvent.click(screen.getByRole("button", { name: "I agree, save my voice" }));
    // No separate "use this recording" step and no recording again.
    expect(screen.queryByTestId("recorder")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Keep my voice" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/voice?saved=1"));
    expect(calls).toEqual(["/api/voice/from-guest", "/api/voice/sample?candidate=1", "/api/voice/keep"]);
    expect(calls.join()).not.toMatch(/billing|checkout|family/);
  });

  it("says the demo recording expired and records afresh", () => {
    render(<AccountVoiceSetup hasVoice={false} next={VOICE_SAVED} guestTake={null} fromTry />);
    expect(screen.getByTestId("demo-take-expired").textContent).toContain("expired");
    agreeToAll();
    fireEvent.click(screen.getByRole("button", { name: "I agree" }));
    expect(screen.getByTestId("recorder")).toBeTruthy();
  });

  it("falls back to recording when the take is deleted partway through", async () => {
    fromGuestStatus = 410;
    render(<AccountVoiceSetup hasVoice={false} next={VOICE_SAVED} guestTake={take} fromTry />);
    agreeToAll();
    fireEvent.click(screen.getByRole("button", { name: "I agree, save my voice" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Your earlier recording isn't here anymore. Please record your voice again.");
    expect(screen.getByTestId("recorder")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it("tells an existing Readli Voice user their current voice keeps working until they keep this one", () => {
    render(<AccountVoiceSetup hasVoice next={VOICE_SAVED} guestTake={take} fromTry />);
    expect(screen.getByText(/You already have a Readli voice/)).toBeTruthy();
  });
});
