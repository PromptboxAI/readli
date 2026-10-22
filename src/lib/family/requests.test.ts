import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import { familyHome } from "./home";
import type { Actor } from "./model";
import { childRequests, dismissStoryRequest, MAX_OPEN_REQUESTS, MemoryFamilyStore, requestStory } from "./service";
import { CATALOG } from "@/lib/library/catalog";
import { seedDemoNarrations } from "@/lib/narration/demo-seed";
import { MemoryNarrationStorage } from "@/lib/narration/storage";
import { DEFAULT_PLAN } from "./plan";

const mom: Actor = { kind: "adult", adultId: "sara" };
const grandma: Actor = { kind: "adult", adultId: "june" };
const maya: Actor = { kind: "child", childId: "maya" };
const leo: Actor = { kind: "child", childId: "leo" };
const BOOK = "thumbelina";

let tick = Date.parse("2026-10-20T00:00:00Z");
const clock = () => new Date((tick += 1000));

function fresh() {
  const state = demoFamilyState();
  return { state, store: new MemoryFamilyStore(state) };
}

describe("story requests", () => {
  it("a child asks once per book, and only for themselves", async () => {
    const { store } = fresh();
    expect(await requestStory(store, maya, "maya", BOOK, clock)).toEqual([BOOK]);
    expect(await requestStory(store, maya, "maya", BOOK, clock)).toEqual([BOOK]);
    expect((await store.read()).requests).toHaveLength(1);
    await expect(requestStory(store, maya, "leo", BOOK, clock)).rejects.toMatchObject({ status: 403 });
    expect(await childRequests(store, leo, "leo")).toEqual([]);
  });

  it("asking spends nothing and prepares nothing", async () => {
    const { store } = fresh();
    const before = await store.read();
    const credits = JSON.stringify(before.entitlements);
    const jobs = before.jobs.length;
    const libraries = before.libraries.length;
    await requestStory(store, maya, "maya", BOOK, clock);
    const after = await store.read();
    expect(JSON.stringify(after.entitlements)).toBe(credits);
    expect(after.jobs).toHaveLength(jobs);
    expect(after.libraries).toHaveLength(libraries);
  });

  it("caps how many stories a child can have waiting", async () => {
    const { store } = fresh();
    const slugs = CATALOG.map((b) => b.slug);
    for (const slug of slugs.slice(0, MAX_OPEN_REQUESTS)) await requestStory(store, maya, "maya", slug, clock);
    await expect(requestStory(store, maya, "maya", slugs[MAX_OPEN_REQUESTS]!, clock)).rejects.toMatchObject({ status: 429 });
  });

  it("shows on Family Home with a link to prepare the book, until a parent clears it", async () => {
    const { store } = fresh();
    await requestStory(store, maya, "maya", BOOK, clock);
    const home = familyHome(await store.read(), DEMO_HOUSEHOLD_ID);
    expect(home.requests).toHaveLength(1);
    expect(home.requests[0]).toMatchObject({ childName: "Maya", slug: BOOK, href: `/family/books/${BOOK}` });

    const id = home.requests[0]!.id;
    await expect(dismissStoryRequest(store, maya, id, clock)).rejects.toMatchObject({ status: 403 });
    await expect(dismissStoryRequest(store, grandma, id, clock)).rejects.toMatchObject({ status: 403 });
    await dismissStoryRequest(store, mom, id, clock);
    expect(familyHome(await store.read(), DEMO_HOUSEHOLD_ID).requests).toEqual([]);
    expect(await childRequests(store, maya, "maya")).toEqual([]);
  });

  it("drops off Home once the book is on that child's shelf", async () => {
    const { state, store } = fresh();
    await seedDemoNarrations(state, new MemoryNarrationStorage(), DEFAULT_PLAN, DEMO_HOUSEHOLD_ID);
    const ready = familyHome(state, DEMO_HOUSEHOLD_ID).shelf.find((b) => b.kids.some((k) => k.id === "maya"));
    expect(ready).toBeDefined();
    await requestStory(store, maya, "maya", ready!.slug, clock);
    await requestStory(store, maya, "maya", BOOK, clock);
    expect(familyHome(await store.read(), DEMO_HOUSEHOLD_ID).requests.map((r) => r.slug)).toEqual([BOOK]);
  });
});
