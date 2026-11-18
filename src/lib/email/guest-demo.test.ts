import { describe, expect, it } from "vitest";
import { fakeEmailDb } from "./fake-db.test-util";
import { DEMO_EMAILS_PER_ADDRESS_PER_DAY, demoEmailOn, guestForDemoToken, hashDemoToken, looksLikeEmail, requestDemoEmail } from "./guest-demo";

const SECRET = "test-secret";
const NOW = new Date("2026-10-24T15:00:00Z");
const LATER = new Date(NOW.getTime() + 20 * 3_600_000).toISOString();
const guest = (over: Partial<{ id: string; expiresAt: string; generationsUsed: number }> = {}) => ({ id: "g1", expiresAt: LATER, generationsUsed: 1, ...over });

function setup() {
  const fake = fakeEmailDb({});
  const ask = (g = guest(), input = { email: "Pat@Example.com ", marketing: false }) => requestDemoEmail(fake.db, SECRET, "https://readli.test/", g, input, NOW);
  return { fake, ask };
}

describe("Email me my demo", () => {
  it("queues one G1 email with a private link, tied to the guest session", async () => {
    const { fake, ask } = setup();
    const res = await ask();
    expect(res.outcome).toBe("queued");
    const row = fake.tables.email_outbox![0]!;
    expect(row).toMatchObject({ email_id: "G1", dedupe_key: "G1:g1", guest_session_id: "g1", category: "transactional" });
    expect(JSON.stringify(row)).not.toContain("Pat@Example.com");
    const token = /\/try\/demo\/([\w-]+)/.exec(row.body as string)![1]!;
    const saved = fake.tables.guest_demo_emails![0]!;
    expect(saved.token_hash).toBe(hashDemoToken(token));
    expect(JSON.stringify(saved)).not.toContain(token);
    expect(await guestForDemoToken(fake.db, token, NOW)).toBe("g1");
    expect(await guestForDemoToken(fake.db, token, new Date(LATER))).toBeNull();
    expect(await guestForDemoToken(fake.db, "nope", NOW)).toBeNull();
  });

  it("keeps no address and records no consent without the marketing box", async () => {
    const { fake, ask } = setup();
    await ask();
    expect(fake.tables.email_marketing_contacts ?? []).toEqual([]);
    expect(fake.tables.email_consent_events ?? []).toEqual([]);
    expect(fake.tables.email_outbox![0]!.body).toContain("along with this email address");
  });

  it("saves marketing consent separately when asked", async () => {
    const { fake, ask } = setup();
    await ask(guest(), { email: "pat@example.com", marketing: true });
    expect(fake.tables.email_marketing_contacts).toHaveLength(1);
    expect(fake.tables.email_marketing_contacts![0]).toMatchObject({ source: "guest_demo", unsubscribed_at: null });
    expect(fake.tables.email_consent_events![0]).toMatchObject({ topic: "marketing", granted: true, source: "guest_demo" });
  });

  it("sends once per demo, needs a story heard, and stops at expiry", async () => {
    const { ask } = setup();
    expect((await ask(guest({ generationsUsed: 0 }))).outcome).toBe("nothing_heard");
    expect((await ask(guest({ expiresAt: NOW.toISOString() }))).outcome).toBe("expired");
    expect((await ask()).outcome).toBe("queued");
    expect((await ask()).outcome).toBe("already_sent");
  });

  it("limits how many demos one address gets a day", async () => {
    const { ask } = setup();
    for (let i = 0; i < DEMO_EMAILS_PER_ADDRESS_PER_DAY; i++) expect((await ask(guest({ id: `g${i}` }))).outcome).toBe("queued");
    expect((await ask(guest({ id: "g-last" }))).outcome).toBe("address_limit");
  });

  it("is offered only when G1 is switched on", async () => {
    const fake = fakeEmailDb({ email_switches: [{ email_id: "G1", enabled: true }] });
    expect(await demoEmailOn(fake.db, true)).toBe(true);
    expect(await demoEmailOn(fake.db, false)).toBe(false);
    expect(await demoEmailOn(fakeEmailDb({}).db, true)).toBe(false);
    expect(await demoEmailOn(null, true)).toBe(false);
  });

  it("checks addresses loosely", () => {
    expect(looksLikeEmail("a@b.co")).toBe(true);
    expect(looksLikeEmail("nope")).toBe(false);
    expect(looksLikeEmail(42)).toBe(false);
  });
});
