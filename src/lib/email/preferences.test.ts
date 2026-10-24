import { describe, expect, it } from "vitest";
import { fakeEmailDb } from "./fake-db.test-util";
import { oneClickUnsubscribeUrl, preferencesFor, preferencesToken, updatePreferences, userFromPreferencesToken } from "./preferences";

const SECRET = "test-secret";
const USER = "6f1c2c1e-1111-4a4a-9b9b-123456789abc";

describe("email preferences", () => {
  it("default to reminders on and marketing off", async () => {
    const { db } = fakeEmailDb();
    expect(await preferencesFor(db, USER)).toEqual({ setup_reminders: true, invitation_reminders: true, feedback_requests: true, marketing: false, timeZone: null });
  });

  it("record every consent change with where it came from", async () => {
    const { db, tables } = fakeEmailDb({ adult_profiles: [{ user_id: USER, marketing_opt_in: false }] });
    await updatePreferences(db, USER, { marketing: true, timeZone: "America/Chicago" }, "signup");
    await updatePreferences(db, USER, { marketing: true }, "account_settings");
    await updatePreferences(db, USER, { setup_reminders: false, marketing: false }, "email_preferences");
    expect(tables.email_consent_events!.map((e) => [e.topic, e.granted, e.source])).toEqual([
      ["marketing", true, "signup"],
      ["setup_reminders", false, "email_preferences"],
      ["marketing", false, "email_preferences"],
    ]);
    expect(await preferencesFor(db, USER)).toMatchObject({ setup_reminders: false, marketing: false, timeZone: "America/Chicago" });
    expect(tables.adult_profiles![0]!.marketing_opt_in).toBe(false);
  });

  it("sign links so only the right grown-up's settings change", () => {
    const token = preferencesToken(SECRET, USER);
    expect(userFromPreferencesToken(SECRET, token)).toBe(USER);
    expect(userFromPreferencesToken("other-secret", token)).toBeNull();
    expect(userFromPreferencesToken(SECRET, token.replace(USER, "6f1c2c1e-2222-4a4a-9b9b-123456789abc"))).toBeNull();
    expect(userFromPreferencesToken(SECRET, "nonsense")).toBeNull();
    expect(oneClickUnsubscribeUrl("https://readli.ai/", SECRET, USER, "marketing")).toBe(
      `https://readli.ai/api/email/unsubscribe?t=${encodeURIComponent(token)}&topic=marketing`,
    );
  });
});
