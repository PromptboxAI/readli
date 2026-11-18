import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("next/image", () => ({ default: (p: { alt: string }) => <span role="img" aria-label={p.alt} /> }));

import { FamilyOffer } from "./FamilyOffer";
import { StorytellerSteps, type StepsProps } from "./StorytellerSteps";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";
const base: StepsProps = {
  token: TOKEN,
  name: "Grandpa Joe",
  connected: true,
  needsFamily: false,
  autoConnect: false,
  voiceId: "v1",
  plan: "active",
  checkout: { invitationId: "inv-1", billing: "monthly", paymentsOn: true, canceled: false, monthlyCents: 1999, annualCents: 17999, monthly: "$19.99", annual: "$179.99", monthlyCredits: 40 },
  active: false,
  slotsUsed: 1,
  slotsTotal: 2,
  slotPrice: "$4.99",
  slotsForSale: true,
  kids: [
    { id: "k1", nickname: "Mia", approved: false },
    { id: "k2", nickname: "Leo", approved: false },
  ],
  book: { slug: "winnie-the-pooh", title: "Winnie-the-Pooh", coverUrl: "/covers/pooh.webp" },
};
const steps = (p: Partial<StepsProps> = {}) => render(<StorytellerSteps {...base} {...p} />);
const state = (key: string) => screen.getByTestId(`step-${key}`).dataset.state;

let posted: { url: string; method: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      posted.push({ url, method: init?.method ?? "GET", body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify(url === "/api/billing/checkout" ? { url: "https://checkout.stripe.com/x" } : { ok: true }), { status: 200 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("StorytellerSteps: after an invitation", () => {
  it("new subscriber: arriving from the invitation page starts a family and connects, with nothing else switched on", async () => {
    steps({ connected: false, needsFamily: true, autoConnect: true, voiceId: null, plan: "none", active: false, slotsTotal: 0, slotsUsed: 0 });
    await waitFor(() => expect(posted.map((p) => p.url)).toEqual(["/api/family/household", "/api/invitations/accept"]));
    expect(posted[0]!.body).toEqual({ provisional: true });
    expect(posted[1]!.body).toEqual({ token: TOKEN });
    expect(refresh).toHaveBeenCalled();
    expect(state("slot")).toBe("locked");
    expect(state("children")).toBe("locked");
    expect(state("story")).toBe("locked");
  });

  it("without the invitation page's button, connecting waits for the parent", () => {
    steps({ connected: false, plan: "none", voiceId: null });
    expect(posted).toEqual([]);
    fireEvent.click(screen.getByTestId("connect-storyteller"));
    expect(posted.map((p) => p.url)).toEqual(["/api/invitations/accept"]);
  });

  it("new subscriber: checkout uses the live prices, says it charges at checkout, and comes back to these steps", async () => {
    steps({ plan: "none" });
    expect(state("plan")).toBe("current");
    expect(state("slot")).toBe("locked");
    const plan = screen.getByTestId("step-plan");
    expect(within(plan).getByTestId("billing-disclosure").textContent).toContain("$19.99 a month, charged when you check out, with 40 narration credits every month");
    fireEvent.click(within(plan).getByRole("radio", { name: /Yearly/ }));
    expect(within(plan).getByTestId("billing-disclosure").textContent).toContain("$179.99 a year");
    expect(plan.textContent).not.toMatch(/trial|free for/i);
    vi.stubGlobal("location", { assign: vi.fn() });
    fireEvent.click(within(plan).getByTestId("circle-checkout"));
    await waitFor(() => expect(posted[0]?.url).toBe("/api/billing/checkout"));
    expect(posted[0]!.body).toEqual({ item: "family_annual", invitationId: "inv-1", returnPath: `/v/${TOKEN}/connect` });
  });

  it("interrupted checkout: back from a canceled Stripe page, nothing was charged and the storyteller is still connected", () => {
    steps({ plan: "none", checkout: { ...base.checkout, canceled: true } });
    expect(state("connect")).toBe("done");
    expect(screen.getByTestId("checkout-canceled").textContent).toContain("nothing was charged");
  });

  it("back from Stripe before the webhook: waits for the plan, slot still locked", () => {
    steps({ plan: "starting" });
    expect(screen.getByTestId("plan-starting")).toBeTruthy();
    expect(state("slot")).toBe("locked");
  });

  it("existing subscriber: no plan step, straight to activating the storyteller", () => {
    steps();
    expect(screen.queryByTestId("step-plan")).toBeNull();
    expect(state("slot")).toBe("current");
    expect(screen.getByTestId("step-slot").textContent).toContain("Uses 1 of your 2 storyteller slots");
    fireEvent.click(screen.getByTestId("activate-storyteller"));
    expect(posted[0]).toMatchObject({ url: "/api/family/narrators", body: { voiceId: "v1", action: "activate" } });
    expect(state("children")).toBe("locked");
  });

  it("full slots: says so and offers to manage or add a slot, never activates", () => {
    steps({ slotsUsed: 2, slotsTotal: 2 });
    expect(screen.getByTestId("slots-full").textContent).toContain("All 2 storyteller slots are in use");
    expect(screen.queryByTestId("activate-storyteller")).toBeNull();
    expect(screen.getByTestId("add-slot").textContent).toContain("$4.99 a month");
  });

  it("children: every switch starts off and each is the parent's own tap", () => {
    steps({ active: true });
    expect(state("children")).toBe("current");
    const mia = screen.getByRole("switch", { name: "Mia can hear Grandpa Joe" }) as HTMLInputElement;
    const leo = screen.getByRole("switch", { name: "Leo can hear Grandpa Joe" }) as HTMLInputElement;
    expect([mia.checked, leo.checked]).toEqual([false, false]);
    expect(state("story")).toBe("locked");
    fireEvent.click(mia);
    expect(posted[0]).toMatchObject({ url: "/api/family/kids/k1/storytellers", method: "PUT", body: { changes: [{ voiceId: "v1", approved: true }] } });
  });

  it("prepare the book opens once a child can listen, for the intended voice, without narrating anything yet", () => {
    steps({ active: true, kids: [{ id: "k1", nickname: "Mia", approved: true }] });
    expect(state("children")).toBe("done");
    expect(state("story")).toBe("current");
    expect(screen.getByTestId("prepare-book").getAttribute("href")).toBe("/family/books/winnie-the-pooh?voice=v1&scope=book");
    expect(posted).toEqual([]);
  });
});

describe("FamilyOffer", () => {
  it("shows the live price and charges at checkout, with no trial", () => {
    render(<FamilyOffer token={TOKEN} name="Grandpa Joe" monthly="$19.99" annual="$179.99" monthlyCredits={40} savingsPercent={25} startHref={`/v/${TOKEN}/start`} laterHref={`/v/${TOKEN}/start`} />);
    expect(screen.getByTestId("billing-disclosure").textContent).toContain("$19.99 a month, charged when you check out");
    expect(screen.getByTestId("family-offer").textContent).not.toMatch(/trial/i);
    expect(screen.getByTestId("start-family").getAttribute("href")).toBe(`/v/${TOKEN}/start?billing=monthly`);
    fireEvent.click(screen.getByTestId("start-family"));
    expect(posted[0]).toMatchObject({ url: "/api/invitations/event", body: { token: TOKEN, event: "family_cta" } });
  });

  it("while checkout is off, says nothing is charged and saves the storyteller for later", () => {
    render(<FamilyOffer token={TOKEN} name="Grandpa Joe" monthly="$19.99" annual="$179.99" monthlyCredits={40} savingsPercent={25} startHref={null} laterHref={`/v/${TOKEN}/start`} />);
    expect(screen.getByTestId("billing-disclosure").textContent).toContain("nothing is charged");
    expect(screen.getByTestId("start-family").textContent).toBe("Save Grandpa Joe for later");
  });
});
