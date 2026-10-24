import { describe, expect, it } from "vitest";
import { adultResume } from "@/lib/narration/narration";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import type { Actor } from "./model";
import { DEFAULT_PLAN } from "./plan";
import { heardAt } from "./places";
import { adultBookPlace, childBookState, MemoryFamilyStore, PermissionError, saveAdultProgress, saveChildProgress } from "./service";

const mom: Actor = { kind: "adult", adultId: "sara" };
const june: Actor = { kind: "adult", adultId: "june" };
const maya: Actor = { kind: "child", childId: "maya" };
const H = DEMO_HOUSEHOLD_ID;
const BOOK = "the-lion-and-the-mouse";
const at = (s: number) => new Date(Date.parse("2026-10-24T12:00:00Z") + s * 1000).toISOString();

function family() {
  const state = demoFamilyState();
  return { state, store: new MemoryFamilyStore(state, DEFAULT_PLAN) };
}

describe("saved listening places", () => {
  it("keeps a child's place heard last, whatever order the saves arrive in", async () => {
    const { store } = family();
    const save = (sentence: number, heard: number) => saveChildProgress(store, maya, { childId: "maya", bookSlug: BOOK, sentence, voiceId: "voice-sara", listenedAt: at(heard) });
    expect(await save(5, 50)).toBe(true);
    // A save from earlier listening arrives late (retried, or sent after time offline).
    expect(await save(2, 20)).toBe(false);
    expect((await childBookState(store, maya, "maya", BOOK)).sentence).toBe(5);
    expect(await save(6, 60)).toBe(true);
    expect((await childBookState(store, maya, "maya", BOOK)).sentence).toBe(6);
  });

  it("settles many saves racing each other on the newest one", async () => {
    const { store } = family();
    const order = Array.from({ length: 40 }, (_, i) => i).sort(() => Math.random() - 0.5);
    await Promise.all(order.map((i) => saveChildProgress(store, maya, { childId: "maya", bookSlug: BOOK, sentence: i, voiceId: "voice-sara", listenedAt: at(i) })));
    expect((await childBookState(store, maya, "maya", BOOK)).sentence).toBe(39);
  });

  it("replaces a place saved before saves said when they were heard", async () => {
    const { state, store } = family();
    state.progress.push({ childId: "maya", bookSlug: BOOK, sentence: 9, voiceId: "voice-sara", textRevision: null, updatedAt: at(0) });
    expect(await saveChildProgress(store, maya, { childId: "maya", bookSlug: BOOK, sentence: 3, voiceId: "voice-sara", listenedAt: at(-100) })).toBe(true);
  });

  it("keeps a grown-up's place apart from every child's, newest wins there too", async () => {
    const { state, store } = family();
    await saveChildProgress(store, maya, { childId: "maya", bookSlug: BOOK, sentence: 4, voiceId: "voice-sara", listenedAt: at(10) });
    const save = (sentence: number, heard: number) => saveAdultProgress(store, mom, { householdId: H, bookSlug: BOOK, sentence, voiceId: "voice-june", textRevision: null, listenedAt: at(heard) });
    expect(await save(7, 30)).toBe(true);
    expect(await save(1, 5)).toBe(false);
    expect((await adultBookPlace(store, mom, H, BOOK))?.sentence).toBe(7);
    expect((await childBookState(store, maya, "maya", BOOK)).sentence).toBe(4);
    expect(state.progress).toHaveLength(1);
    // Only a guardian of the household has a grown-up place here, and a child can't write one.
    await expect(saveAdultProgress(store, june, { householdId: H, bookSlug: BOOK, sentence: 1, voiceId: null, textRevision: null })).rejects.toBeInstanceOf(PermissionError);
    await expect(saveAdultProgress(store, maya, { householdId: H, bookSlug: BOOK, sentence: 1, voiceId: null, textRevision: null })).rejects.toBeInstanceOf(PermissionError);
  });

  it("resumes a grown-up at their own place in the voice's text", async () => {
    const { store } = family();
    expect((await adultResume(store, mom, H, BOOK, "voice-sara")).sentence).toBe(0);
    await saveAdultProgress(store, mom, { householdId: H, bookSlug: BOOK, sentence: 3, voiceId: "voice-sara", textRevision: null, listenedAt: at(1) });
    expect(await adultResume(store, mom, H, BOOK, "voice-sara")).toEqual({ sentence: 3, voiceId: "voice-sara" });
  });

  it("dates a save by how long ago the device heard it, so a wrong device clock can't win", async () => {
    const { store } = family();
    const now = new Date(at(100));
    // One device saves a place it heard 10 seconds ago...
    await saveChildProgress(store, maya, { childId: "maya", bookSlug: BOOK, sentence: 8, voiceId: "voice-sara", listenedAt: heardAt({ listenedAt: 990_000, sentAt: 1_000_000 }, now) });
    // ...then a device whose clock is an hour ahead sends a place it heard 80 seconds ago: it doesn't win.
    const fast = Date.parse(at(100)) + 3_600_000;
    const saved = await saveChildProgress(store, maya, { childId: "maya", bookSlug: BOOK, sentence: 2, voiceId: "voice-sara", listenedAt: heardAt({ listenedAt: fast - 80_000, sentAt: fast }, now) });
    expect(saved).toBe(false);
    expect((await childBookState(store, maya, "maya", BOOK)).sentence).toBe(8);
  });
});
