import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("@/components/teleprompter/TeleprompterRecorder", () => ({ TeleprompterRecorder: () => <div data-testid="recorder" /> }));

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

const agree = () => fireEvent.click(screen.getByRole("checkbox"));

describe("AccountVoiceSetup from Save My Voice Free", () => {
  it("offers the demo recording first, with one consent, then leads to choosing a story", async () => {
    render(<AccountVoiceSetup hasVoice={false} guestTake={take} fromTry askName />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: /Use this recording/ })).toHaveProperty("checked", true);
    expect(screen.getByTestId("guest-take-offer").textContent).toContain("1:12");
    const create = screen.getByRole("button", { name: "Create & Hear My Voice" });
    expect(create).toHaveProperty("disabled", true);
    agree();
    fireEvent.click(create);
    expect(screen.queryByTestId("recorder")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Keep This Voice" }));
    expect(await screen.findByRole("heading", { name: "Your Readli voice is ready!" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Choose a Story to Share" }).getAttribute("href")).toBe("/voice/invite");
    expect(screen.getByRole("link", { name: "Go to My Voice" }).getAttribute("href")).toBe("/voice");
    expect(screen.getByTestId("ask-name")).toBeTruthy();
    expect(calls).toEqual(["/api/voice/from-guest", "/api/voice/sample?candidate=1", "/api/voice/keep"]);
    expect(calls.join()).not.toMatch(/billing|checkout|family/);
    expect(assign).not.toHaveBeenCalled();
  });

  it("never autoplays the sample", async () => {
    const { container } = render(<AccountVoiceSetup hasVoice={false} guestTake={take} fromTry />);
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Create & Hear My Voice" }));
    await screen.findByRole("button", { name: "Keep This Voice" });
    const audio = container.querySelector("audio")!;
    expect(audio.autoplay).toBe(false);
  });

  it("can record a new one instead of the demo take", () => {
    render(<AccountVoiceSetup hasVoice={false} guestTake={take} fromTry />);
    fireEvent.click(screen.getByRole("radio", { name: /Record a new one/ }));
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Continue to recording" }));
    expect(screen.getByTestId("recorder")).toBeTruthy();
  });

  it("says the demo recording expired and records afresh", () => {
    render(<AccountVoiceSetup hasVoice={false} guestTake={null} fromTry />);
    expect(screen.getByTestId("demo-take-expired").textContent).toContain("expired");
    expect(screen.queryByRole("radio")).toBeNull();
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Continue to recording" }));
    expect(screen.getByTestId("recorder")).toBeTruthy();
  });

  it("falls back to recording when the take is deleted partway through", async () => {
    fromGuestStatus = 410;
    render(<AccountVoiceSetup hasVoice={false} guestTake={take} fromTry />);
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Create & Hear My Voice" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Your earlier recording isn't here anymore. Please record your voice again.");
    expect(screen.getByTestId("recorder")).toBeTruthy();
  });

  it("keeps an existing voice working until the new one is kept, without first-time copy", async () => {
    render(<AccountVoiceSetup hasVoice guestTake={take} fromTry />);
    expect(screen.getByTestId("replacing-voice").textContent).toContain("keeps working");
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Create & Hear My Voice" }));
    await screen.findByRole("button", { name: "Keep This Voice" });
    expect(screen.getByText("Your current voice stays in use until you keep this one.")).toBeTruthy();
    expect(calls).not.toContain("/api/voice/keep");
  });

  it("goes back to an invitation's page when one sent them here", async () => {
    render(<AccountVoiceSetup hasVoice={false} guestTake={take} next="/voice/join/h1" />);
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Create & Hear My Voice" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep This Voice" }));
    expect((await screen.findByRole("link", { name: "Continue" })).getAttribute("href")).toBe("/voice/join/h1");
    expect(screen.queryByRole("link", { name: "Go to My Voice" })).toBeNull();
  });
});
