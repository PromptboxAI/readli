import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import {
  chooseListener,
  deviceCookieValue,
  deviceForCookie,
  deviceStatus,
  exitWithPin,
  hashPin,
  listDevices,
  MemoryDeviceRegistry,
  parseDeviceCookie,
  pinMatches,
  registerDevice,
  revokeDevice,
  setFamilyPin,
} from "./devices";
import { PermissionError } from "./service";

const SECRET = "test-secret";
const SARA = { kind: "adult" as const, adultId: "sara" };
const T0 = new Date("2026-10-12T12:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 24 * 60 * 60 * 1000);

async function setUp(childIds = ["maya", "leo"]) {
  const registry = new MemoryDeviceRegistry();
  const state = demoFamilyState();
  const { device, token } = await registerDevice(registry, state, SARA, { scope: "sandbox-1", childIds, label: "Family iPad" }, SECRET, T0);
  return { registry, state, device, cookie: deviceCookieValue(device, token) };
}

async function refused(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).code).toBe(code);
  return err as PermissionError;
}

describe("kids devices", () => {
  it("keeps only a hash of the device key, and the cookie works only with the right key", async () => {
    const { registry, device, cookie } = await setUp();
    const parsed = parseDeviceCookie(cookie)!;
    expect(parsed.id).toBe(device.id);
    expect(device.tokenHash).not.toContain(parsed.token);
    expect((await deviceForCookie(registry, cookie, SECRET, T0))?.id).toBe(device.id);
    expect(await deviceForCookie(registry, cookie.slice(0, -2) + "xx", SECRET, T0)).toBeNull();
    expect(await deviceForCookie(registry, cookie, "another-secret", T0)).toBeNull();
    expect(await deviceForCookie(registry, "user~kid.sig", SECRET, T0)).toBeNull();
  });

  it("ends a device after 90 days unused, and use keeps it going", async () => {
    const { registry, cookie } = await setUp();
    expect(await deviceForCookie(registry, cookie, SECRET, days(89))).not.toBeNull();
    // Used on day 89, so day 170 is only 81 days later.
    expect(await deviceForCookie(registry, cookie, SECRET, days(170))).not.toBeNull();
    expect(await deviceForCookie(registry, cookie, SECRET, days(261))).toBeNull();
    expect(deviceStatus({ revokedAt: null, lastSeenAt: T0.toISOString() }, days(91))).toBe("expired");
  });

  it("a revoked device loses access on its next request", async () => {
    const { registry, state, device, cookie } = await setUp();
    await revokeDevice(registry, state, { kind: "adult", adultId: "ben" }, device.id, T0);
    expect(await deviceForCookie(registry, cookie, SECRET, T0)).toBeNull();
    const [view] = await listDevices(registry, state, SARA, DEMO_HOUSEHOLD_ID, T0);
    expect(view).toMatchObject({ label: "Family iPad", kids: ["Maya", "Leo"], registeredBy: "Mom", status: "revoked" });
  });

  it("only the family's guardians set up, list and end devices", async () => {
    const { registry, state, device } = await setUp();
    const grandma = { kind: "adult" as const, adultId: "june" };
    await refused(registerDevice(registry, state, grandma, { scope: "s", childIds: ["maya"] }, SECRET), "not_guardian");
    await refused(registerDevice(registry, state, { kind: "child", childId: "maya" }, { scope: "s", childIds: ["maya"] }, SECRET), "not_guardian");
    await refused(registerDevice(registry, state, SARA, { scope: "s", childIds: ["someone-else"] }, SECRET), "not_guardian");
    await refused(registerDevice(registry, state, SARA, { scope: "s", childIds: [] }, SECRET), "choose_kids");
    await refused(listDevices(registry, state, grandma, DEMO_HOUSEHOLD_ID), "not_guardian");
    await refused(revokeDevice(registry, state, grandma, device.id), "no_device");
    await refused(revokeDevice(registry, state, { kind: "child", childId: "maya" }, device.id), "not_guardian");
  });

  it("kids pick who's listening only from the kids on the device", async () => {
    const { registry, device } = await setUp(["maya"]);
    expect(device.activeChildId).toBe("maya");
    await refused(chooseListener(registry, device, "leo"), "not_on_device");
    await chooseListener(registry, device, null);
    expect((await registry.get(device.id))?.activeChildId).toBeNull();
  });

  it("stores the PIN as a salted hash and checks it", async () => {
    const a = await hashPin("4821");
    expect(a).not.toContain("4821");
    expect(a).not.toBe(await hashPin("4821"));
    expect(await pinMatches("4821", a)).toBe(true);
    expect(await pinMatches("4822", a)).toBe(false);
  });

  it("needs a 4-digit PIN set by a guardian", async () => {
    const { registry, state } = await setUp();
    await refused(setFamilyPin(registry, state, SARA, DEMO_HOUSEHOLD_ID, "12345"), "bad_pin");
    await refused(setFamilyPin(registry, state, SARA, DEMO_HOUSEHOLD_ID, "12a4"), "bad_pin");
    await refused(setFamilyPin(registry, state, { kind: "adult", adultId: "june" }, DEMO_HOUSEHOLD_ID, "1234"), "not_guardian");
    await refused(setFamilyPin(registry, state, { kind: "child", childId: "maya" }, DEMO_HOUSEHOLD_ID, "1234"), "not_guardian");
  });

  it("can't leave without a PIN set", async () => {
    const { registry, device } = await setUp();
    await refused(exitWithPin(registry, device, "1234", T0), "no_pin");
  });

  it("locks the device for 15 minutes after 5 wrong PINs, even for the right PIN", async () => {
    const { registry, state, device, cookie } = await setUp();
    await setFamilyPin(registry, state, SARA, DEMO_HOUSEHOLD_ID, "4821");
    for (let i = 1; i <= 4; i++) {
      const err = await refused(exitWithPin(registry, device, "0000", T0), "wrong_pin");
      expect(err.details?.triesLeft).toBe(5 - i);
    }
    await refused(exitWithPin(registry, device, "0000", T0), "pin_locked");
    await refused(exitWithPin(registry, device, "4821", new Date(T0.getTime() + 14 * 60 * 1000)), "pin_locked");
    expect(await deviceForCookie(registry, cookie, SECRET, T0)).not.toBeNull();
    await exitWithPin(registry, device, "4821", new Date(T0.getTime() + 16 * 60 * 1000));
    // Leaving ends the device, so the cookie can't be used to get back in.
    expect(await deviceForCookie(registry, cookie, SECRET, T0)).toBeNull();
  });

  it("refuses PINs that aren't 4 digits without matching them", async () => {
    const { registry, state, device } = await setUp();
    await setFamilyPin(registry, state, SARA, DEMO_HOUSEHOLD_ID, "4821");
    await refused(exitWithPin(registry, device, { pin: "4821" }, T0), "wrong_pin");
    await refused(exitWithPin(registry, device, "48210", T0), "wrong_pin");
  });
});
