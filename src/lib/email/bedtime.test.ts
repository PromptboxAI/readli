import { describe, expect, it } from "vitest";
import { emailHash } from "@/lib/invitations/server";
import { NEWEST_BOOKS } from "@/lib/library/catalog";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { BedtimeError, chooseFeaturedBooks, currentWeek, dismissNewThisWeek, featuredBooks, localParts, newThisWeek, queueBedtimeThursdays } from "./bedtime";
import { fakeEmailDb } from "./fake-db.test-util";
import { contactFromToken, contactToken, unsubscribeContact } from "./preferences";

const SECRET = "test-secret";
// Thursday 22 Oct 2026, 4:30pm in New York.
const THU_AFTERNOON = new Date("2026-10-22T20:30:00Z");
const USER = "11111111-1111-4111-8111-111111111111";

describe("Bedtime Thursdays weeks", () => {
  it("starts each week on Thursday in New York", () => {
    expect(currentWeek(new Date("2026-10-22T12:00:00Z"))).toBe("2026-10-22");
    expect(currentWeek(new Date("2026-10-28T12:00:00Z"))).toBe("2026-10-22");
    expect(currentWeek(new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-15");
    expect(localParts(THU_AFTERNOON, "America/New_York")).toEqual({ date: "2026-10-22", weekday: 4, hour: 16 });
  });
});

describe("featured books", () => {
  it("falls back to the two newest not featured before, and keeps them for the week", async () => {
    const fake = fakeEmailDb({ book_features: [{ week_of: "2026-10-15", slugs: [NEWEST_BOOKS[0]!.slug, "nope"], chosen_by: "admin" }] });
    const first = await featuredBooks(fake.db, "2026-10-22");
    expect(first!.books.map((b) => b.slug)).toEqual([NEWEST_BOOKS[1]!.slug, NEWEST_BOOKS[2]!.slug]);
    expect(first!.chosen).toBe(false);
    expect(fake.tables.book_features).toHaveLength(2);
    expect((await featuredBooks(fake.db, "2026-10-22"))!.books).toEqual(first!.books);
  });

  it("uses the admin's pick, and checks it", async () => {
    const fake = fakeEmailDb({});
    const [a, b] = [NEWEST_BOOKS[3]!.slug, NEWEST_BOOKS[4]!.slug];
    await chooseFeaturedBooks(fake.db, "admin", "2026-10-29", [a, b], THU_AFTERNOON);
    expect(await featuredBooks(fake.db, "2026-10-29")).toMatchObject({ chosen: true, books: [{ slug: a }, { slug: b }] });
    await expect(chooseFeaturedBooks(fake.db, "admin", "2026-10-28", [a, b], THU_AFTERNOON)).rejects.toThrow(BedtimeError);
    await expect(chooseFeaturedBooks(fake.db, "admin", "2026-10-15", [a, b], THU_AFTERNOON)).rejects.toThrow("already gone out");
    await expect(chooseFeaturedBooks(fake.db, "admin", "2026-10-29", [a, a], THU_AFTERNOON)).rejects.toThrow("two different");
    await expect(chooseFeaturedBooks(fake.db, "admin", "2026-10-29", [a, "made-up"], THU_AFTERNOON)).rejects.toThrow("from the library");
  });
});

describe("New this week in the app", () => {
  it("shows the week's two stories until closed", async () => {
    const fake = fakeEmailDb({});
    const notice = await newThisWeek(fake.db, USER, THU_AFTERNOON);
    expect(notice!.weekOf).toBe("2026-10-22");
    expect(notice!.books).toHaveLength(2);
    await dismissNewThisWeek(fake.db, USER, "2026-10-22");
    expect(await newThisWeek(fake.db, USER, THU_AFTERNOON)).toBeNull();
    expect(await newThisWeek(fake.db, USER, new Date("2026-10-29T20:30:00Z"))).not.toBeNull();
  });
});

describe("BT1", () => {
  const contact = (email: string, unsubscribed: string | null = null) => ({
    email_hash: emailHash(SECRET, email),
    email_encrypted: new ProviderRefCipher(SECRET).encrypt(email),
    source: "guest_demo",
    unsubscribed_at: unsubscribed,
  });
  const setup = (enabled = ["BT1"]) => {
    const fake = fakeEmailDb({
      email_preferences: [
        { user_id: USER, marketing: true, time_zone: "America/New_York" },
        { user_id: "22222222-2222-4222-8222-222222222222", marketing: true, time_zone: "Europe/London" },
        { user_id: "33333333-3333-4333-8333-333333333333", marketing: false, time_zone: "America/New_York" },
      ],
      email_marketing_contacts: [contact("pat@example.com"), contact("gone@example.com", "2026-10-01T00:00:00Z")],
    });
    const run = (now = THU_AFTERNOON) => queueBedtimeThursdays({ db: fake.db, secret: SECRET, base: "https://readli.test", now, enabled: new Set(enabled) });
    return { fake, run };
  };

  it("goes to people who opted in, on their Thursday afternoon, once a week", async () => {
    const { fake, run } = setup();
    expect(await run()).toBe(2);
    const keys = fake.tables.email_outbox!.map((r) => r.dedupe_key);
    expect(keys).toEqual([`BT1:2026-10-22:${USER}`, `BT1:2026-10-22:c:${emailHash(SECRET, "pat@example.com")}`]);
    expect(await run(new Date("2026-10-22T22:30:00Z"))).toBe(0);
    expect(await run(new Date("2026-10-21T20:30:00Z"))).toBe(0);
  });

  it("links members to the family library and others to the public one, with unsubscribe", async () => {
    const { fake, run } = setup();
    await run();
    const [member, guest] = fake.tables.email_outbox!;
    expect(member!.category).toBe("commercial");
    expect(member!.body).toContain("https://readli.test/family/books/");
    expect(JSON.stringify(member!.headers)).toContain("topic=marketing");
    expect(guest!.body).toContain("https://readli.test/books/");
    expect(guest!.body).not.toContain("/family/");
    expect(JSON.stringify(guest!.headers)).toContain("/api/email/unsubscribe?c=");
    for (const row of [member, guest]) expect(String(row!.body)).not.toMatch(/listened|your child|kid's name|minutes/i);
  });

  it("does nothing while switched off", async () => {
    const { run } = setup([]);
    expect(await run()).toBe(0);
  });
});

describe("contact unsubscribe", () => {
  it("checks the token and records the change once", async () => {
    const hash = emailHash(SECRET, "pat@example.com");
    expect(contactFromToken(SECRET, contactToken(SECRET, hash))).toBe(hash);
    expect(contactFromToken(SECRET, `${hash}.forged`)).toBeNull();
    expect(contactFromToken("other", contactToken(SECRET, hash))).toBeNull();
    const fake = fakeEmailDb({ email_marketing_contacts: [{ email_hash: hash, unsubscribed_at: null }] });
    await unsubscribeContact(fake.db, hash, "one_click_unsubscribe");
    await unsubscribeContact(fake.db, hash, "one_click_unsubscribe");
    expect(fake.tables.email_marketing_contacts![0]!.unsubscribed_at).not.toBeNull();
    expect(fake.tables.email_consent_events).toHaveLength(1);
  });
});
