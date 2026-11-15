import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import { failedPinLock, hashPin, MemoryDeviceRegistry, pinLockedNow, registerDevice, revokeDevice } from "./devices";
import { previewDevices } from "./session";

const SARA = { kind: "adult" as const, adultId: "sara" };
const T0 = new Date("2026-11-15T12:00:00Z");

describe("preview kids devices", () => {
  it("keeps each preview's family PIN and PIN lock to itself, though every preview has the same demo household", async () => {
    const store = new MemoryDeviceRegistry();
    const mine = previewDevices("sandbox-a", store);
    const theirs = previewDevices("sandbox-b", store);
    await mine.setPinHash(DEMO_HOUSEHOLD_ID, await hashPin("1234"), "sara");
    expect(await mine.pinHash(DEMO_HOUSEHOLD_ID)).not.toBeNull();
    expect(await theirs.pinHash(DEMO_HOUSEHOLD_ID)).toBeNull();

    let lock = await theirs.pinLock(DEMO_HOUSEHOLD_ID);
    for (let i = 0; i < 5; i++) lock = failedPinLock(lock, T0);
    await theirs.setPinLock(DEMO_HOUSEHOLD_ID, lock);
    expect(pinLockedNow(await theirs.pinLock(DEMO_HOUSEHOLD_ID), T0)).toBe(true);
    expect(pinLockedNow(await mine.pinLock(DEMO_HOUSEHOLD_ID), T0)).toBe(false);
  });

  it("lists and changes only this preview's devices", async () => {
    const store = new MemoryDeviceRegistry();
    const mine = previewDevices("sandbox-a", store);
    const theirs = previewDevices("sandbox-b", store);
    const state = demoFamilyState();
    const { device } = await registerDevice(mine, state, SARA, { scope: "sandbox-a", childIds: ["maya"], label: "iPad" }, "s", T0);
    expect((await mine.list(DEMO_HOUSEHOLD_ID)).map((d) => d.id)).toEqual([device.id]);
    expect(await theirs.list(DEMO_HOUSEHOLD_ID)).toEqual([]);
    expect(await theirs.get(device.id)).toBeNull();
    await expect(revokeDevice(theirs, state, SARA, device.id, T0)).rejects.toMatchObject({ code: "no_device" });
    await theirs.update(device.id, { revokedAt: T0.toISOString() });
    expect((await mine.get(device.id))?.revokedAt).toBeNull();
  });
});
