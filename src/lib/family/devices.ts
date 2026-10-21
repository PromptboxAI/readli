import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sameHash } from "@/lib/server/guest-token";
import type { Actor, FamilyState } from "./model";
import { activeChild, isGuardianOf } from "./permissions";
import { PermissionError } from "./service";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/**
 * Readli Kids devices. A parent sets up an iPad or phone for chosen kids; the device then holds only
 * a random device key (the database keeps its HMAC), never the parent's sign-in. Every request checks
 * the key against the device record, so a revoked device, or one unused for 90 days, loses access on
 * its next request. Kids pick who's listening from the device's own kids; leaving Readli Kids takes
 * the family's 4-digit grown-up PIN. The PIN only ends Kids Mode on that device: it never signs
 * anyone in or authorizes anything on the grown-up side.
 */
export const DEVICE_IDLE_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
export const PIN_TRIES = 5;
export const PIN_LOCK_MINUTES = 15;

/** "account" for a signed-in family's device (kept in Supabase); otherwise the preview sandbox id. */
export type DeviceScope = string;
export const ACCOUNT_SCOPE = "account";

export interface KidsDevice {
  id: string;
  scope: DeviceScope;
  householdId: string;
  /** The guardian who set the device up. The child's view of the family is read through their households. */
  registeredBy: string;
  label: string;
  childIds: string[];
  activeChildId: string | null;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  failedPinAttempts: number;
  pinLockedUntil: string | null;
}

export interface DeviceRegistry {
  create(device: KidsDevice): Promise<void>;
  get(id: string): Promise<KidsDevice | null>;
  list(householdId: string): Promise<KidsDevice[]>;
  update(id: string, patch: Partial<Omit<KidsDevice, "id" | "scope" | "householdId" | "registeredBy" | "tokenHash">>): Promise<void>;
  pinHash(householdId: string): Promise<string | null>;
  setPinHash(householdId: string, hash: string, by: string): Promise<void>;
}

export type DeviceStatus = "active" | "revoked" | "expired";

export function deviceStatus(d: Pick<KidsDevice, "revokedAt" | "lastSeenAt">, now: Date): DeviceStatus {
  if (d.revokedAt) return "revoked";
  return now.getTime() - Date.parse(d.lastSeenAt) > DEVICE_IDLE_DAYS * DAY ? "expired" : "active";
}

// ---------------------------------------------------------------------------
// The device key in the kids cookie: "d1:<a|p>:<device id>:<random key>"
// ---------------------------------------------------------------------------

const PREFIX = "d1";

export function isDeviceCookie(value: string | undefined): boolean {
  return Boolean(value?.startsWith(`${PREFIX}:`));
}

export function deviceCookieValue(device: Pick<KidsDevice, "id" | "scope">, token: string): string {
  return [PREFIX, device.scope === ACCOUNT_SCOPE ? "a" : "p", device.id, token].join(":");
}

export function parseDeviceCookie(value: string | undefined): { account: boolean; id: string; token: string } | null {
  const [prefix, kind, id, token, ...rest] = (value ?? "").split(":");
  if (prefix !== PREFIX || (kind !== "a" && kind !== "p") || !id || !token || rest.length) return null;
  return { account: kind === "a", id, token };
}

export function hashDeviceToken(token: string, secret: string): string {
  return createHmac("sha256", `${secret}:kids-device`).update(token).digest("hex");
}

/**
 * The device behind a kids cookie, if its key matches and it's still allowed. Refreshes "last used"
 * at most hourly, which keeps a device in use from expiring.
 */
export async function deviceForCookie(
  registry: DeviceRegistry,
  value: string | undefined,
  secret: string,
  now: Date = new Date(),
): Promise<KidsDevice | null> {
  const parsed = parseDeviceCookie(value);
  if (!parsed) return null;
  const device = await registry.get(parsed.id);
  if (!device || !sameHash(device.tokenHash, hashDeviceToken(parsed.token, secret))) return null;
  if (deviceStatus(device, now) !== "active") return null;
  if (now.getTime() - Date.parse(device.lastSeenAt) > TOUCH_EVERY_MS) {
    device.lastSeenAt = now.toISOString();
    await registry.update(device.id, { lastSeenAt: device.lastSeenAt });
  }
  return device;
}

// ---------------------------------------------------------------------------
// What parents and kids can do with devices
// ---------------------------------------------------------------------------

const NOT_GUARDIAN = new PermissionError(403, "not_guardian", "Only a parent or guardian can set up and manage kids devices.");

function guardianAdult(actor: Actor | null): string {
  if (actor?.kind !== "adult") throw NOT_GUARDIAN;
  return actor.adultId;
}

function guardsHousehold(state: FamilyState, adultId: string, householdId: string): boolean {
  return state.members.some((m) => m.adultId === adultId && m.householdId === householdId && m.role === "guardian" && m.removedAt === null);
}

export function cleanLabel(label: unknown): string {
  const text = typeof label === "string" ? label.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  return text || "Kids device";
}

/**
 * Sets up a device for some of a guardian's kids, all in one family. Returns the device and the key
 * that goes in this device's cookie (shown nowhere else).
 */
export async function registerDevice(
  registry: DeviceRegistry,
  state: FamilyState,
  actor: Actor | null,
  input: { scope: DeviceScope; childIds: string[]; activeChildId?: string | null; label?: unknown },
  secret: string,
  now: Date = new Date(),
): Promise<{ device: KidsDevice; token: string }> {
  const adultId = guardianAdult(actor);
  const childIds = [...new Set(input.childIds)];
  const first = childIds[0];
  if (!first) throw new PermissionError(400, "choose_kids", "Choose which kids use this device.");
  for (const id of childIds) {
    if (!isGuardianOf(state, adultId, id)) throw new PermissionError(403, "not_guardian", "You can only add your own kids to a device.");
  }
  const householdId = activeChild(state, first)!.householdId;
  if (childIds.some((id) => activeChild(state, id)!.householdId !== householdId)) {
    throw new PermissionError(400, "one_family", "A device is for kids in one family.");
  }
  const active = input.activeChildId ?? (childIds.length === 1 ? first : null);
  if (active && !childIds.includes(active)) throw new PermissionError(400, "choose_kids", "That child isn't on this device.");
  const token = randomBytes(32).toString("base64url");
  const at = now.toISOString();
  const device: KidsDevice = {
    id: randomUUID(),
    scope: input.scope,
    householdId,
    registeredBy: adultId,
    label: cleanLabel(input.label),
    childIds,
    activeChildId: active,
    tokenHash: hashDeviceToken(token, secret),
    createdAt: at,
    lastSeenAt: at,
    revokedAt: null,
    revokedBy: null,
    failedPinAttempts: 0,
    pinLockedUntil: null,
  };
  await registry.create(device);
  return { device, token };
}

export interface DeviceView {
  id: string;
  label: string;
  kids: string[];
  registeredBy: string;
  createdAt: string;
  lastSeenAt: string;
  status: DeviceStatus;
}

/** A family's devices for its guardians, newest first, including recently ended ones. */
export async function listDevices(registry: DeviceRegistry, state: FamilyState, actor: Actor | null, householdId: string, now: Date = new Date()): Promise<DeviceView[]> {
  const adultId = guardianAdult(actor);
  if (!guardsHousehold(state, adultId, householdId)) throw NOT_GUARDIAN;
  const name = (id: string) => state.children.find((c) => c.id === id)?.nickname;
  const person = (id: string) => state.adults.find((a) => a.id === id)?.displayName ?? "A grown-up";
  return (await registry.list(householdId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => ({
      id: d.id,
      label: d.label,
      kids: d.childIds.map(name).filter((n): n is string => Boolean(n)),
      registeredBy: person(d.registeredBy),
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      status: deviceStatus(d, now),
    }));
}

/** Any guardian of the device's family can end it. It stops working on its next request. */
export async function revokeDevice(registry: DeviceRegistry, state: FamilyState, actor: Actor | null, deviceId: string, now: Date = new Date()): Promise<void> {
  const adultId = guardianAdult(actor);
  const device = await registry.get(deviceId);
  if (!device || !guardsHousehold(state, adultId, device.householdId)) throw new PermissionError(404, "no_device", "We couldn't find that device.");
  if (!device.revokedAt) await registry.update(device.id, { revokedAt: now.toISOString(), revokedBy: adultId, activeChildId: null });
}

/** Who's listening: one of this device's kids, or nobody (back to the picker). */
export async function chooseListener(registry: DeviceRegistry, device: KidsDevice, childId: string | null): Promise<void> {
  if (childId !== null && !device.childIds.includes(childId)) throw new PermissionError(403, "not_on_device", "That profile isn't on this device.");
  device.activeChildId = childId;
  await registry.update(device.id, { activeChildId: childId });
}

// ---------------------------------------------------------------------------
// The grown-up PIN
// ---------------------------------------------------------------------------

export function validPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await scrypt(pin, salt, 32)).toString("base64url")}`;
}

export async function pinMatches(pin: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = await scrypt(pin, Buffer.from(salt, "base64url"), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function setFamilyPin(registry: DeviceRegistry, state: FamilyState, actor: Actor | null, householdId: string, pin: unknown): Promise<void> {
  const adultId = guardianAdult(actor);
  if (!guardsHousehold(state, adultId, householdId)) throw NOT_GUARDIAN;
  if (!validPin(pin)) throw new PermissionError(400, "bad_pin", "Choose a PIN of exactly 4 digits.");
  await registry.setPinHash(householdId, await hashPin(pin), adultId);
}

/**
 * Checks the family PIN to leave Readli Kids on this device. Five wrong tries lock the device for 15
 * minutes. On success the device is ended, so the PIN can't be reused to get back in.
 */
export async function exitWithPin(registry: DeviceRegistry, device: KidsDevice, pin: unknown, now: Date = new Date()): Promise<void> {
  if (device.pinLockedUntil && Date.parse(device.pinLockedUntil) > now.getTime()) {
    throw new PermissionError(429, "pin_locked", "Too many tries. Ask a grown-up to try again in a few minutes.", { lockedUntil: device.pinLockedUntil });
  }
  const stored = await registry.pinHash(device.householdId);
  if (!stored) throw new PermissionError(409, "no_pin", "Your family hasn't set a grown-up PIN yet. A grown-up can sign in to leave Readli Kids.");
  if (!validPin(pin) || !(await pinMatches(pin, stored))) {
    const tries = device.failedPinAttempts + 1;
    const locked = tries >= PIN_TRIES;
    const patch = locked
      ? { failedPinAttempts: 0, pinLockedUntil: new Date(now.getTime() + PIN_LOCK_MINUTES * 60 * 1000).toISOString() }
      : { failedPinAttempts: tries, pinLockedUntil: null };
    Object.assign(device, patch);
    await registry.update(device.id, patch);
    if (locked) throw new PermissionError(429, "pin_locked", "Too many tries. Ask a grown-up to try again in a few minutes.", { lockedUntil: patch.pinLockedUntil });
    throw new PermissionError(403, "wrong_pin", "That PIN isn't right.", { triesLeft: PIN_TRIES - tries });
  }
  await registry.update(device.id, { failedPinAttempts: 0, pinLockedUntil: null, revokedAt: now.toISOString(), revokedBy: device.registeredBy, activeChildId: null });
}

// ---------------------------------------------------------------------------
// Where devices are kept
// ---------------------------------------------------------------------------

export class MemoryDeviceRegistry implements DeviceRegistry {
  readonly devices = new Map<string, KidsDevice>();
  readonly pins = new Map<string, string>();
  async create(device: KidsDevice) {
    this.devices.set(device.id, { ...device, childIds: [...device.childIds] });
  }
  async get(id: string) {
    const d = this.devices.get(id);
    return d ? { ...d, childIds: [...d.childIds] } : null;
  }
  async list(householdId: string) {
    return [...this.devices.values()].filter((d) => d.householdId === householdId).map((d) => ({ ...d, childIds: [...d.childIds] }));
  }
  async update(id: string, patch: Partial<KidsDevice>) {
    const d = this.devices.get(id);
    if (d) this.devices.set(id, { ...d, ...patch });
  }
  async pinHash(householdId: string) {
    return this.pins.get(householdId) ?? null;
  }
  async setPinHash(householdId: string, hash: string) {
    this.pins.set(householdId, hash);
  }
}

type Row = Record<string, unknown>;

const fromRow = (r: Row, childIds: string[]): KidsDevice => ({
  id: r.id as string,
  scope: ACCOUNT_SCOPE,
  householdId: r.household_id as string,
  registeredBy: r.registered_by as string,
  label: r.label as string,
  childIds,
  activeChildId: (r.active_child_id as string | null) ?? null,
  tokenHash: r.token_hash as string,
  createdAt: r.created_at as string,
  lastSeenAt: r.last_seen_at as string,
  revokedAt: (r.revoked_at as string | null) ?? null,
  revokedBy: (r.revoked_by as string | null) ?? null,
  failedPinAttempts: (r.failed_pin_attempts as number) ?? 0,
  pinLockedUntil: (r.pin_locked_until as string | null) ?? null,
});

const COLUMNS: Record<string, string> = {
  label: "label",
  childIds: "",
  activeChildId: "active_child_id",
  lastSeenAt: "last_seen_at",
  revokedAt: "revoked_at",
  revokedBy: "revoked_by",
  failedPinAttempts: "failed_pin_attempts",
  pinLockedUntil: "pin_locked_until",
  createdAt: "created_at",
};

/** Signed-in families' devices, in `kids_devices`, `kids_device_children` and `household_kids_pins` (server-only tables). */
export class SupabaseDeviceRegistry implements DeviceRegistry {
  constructor(private readonly db: SupabaseClient) {}

  private async q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
    return (data ?? []) as T;
  }

  async create(d: KidsDevice) {
    await this.q(
      this.db.from("kids_devices").insert({
        id: d.id,
        household_id: d.householdId,
        registered_by: d.registeredBy,
        label: d.label,
        active_child_id: d.activeChildId,
        token_hash: d.tokenHash,
        created_at: d.createdAt,
        last_seen_at: d.lastSeenAt,
      }),
      "save device",
    );
    await this.q(this.db.from("kids_device_children").insert(d.childIds.map((child_id) => ({ device_id: d.id, child_id }))), "save device kids");
  }

  async get(id: string) {
    const rows = await this.q(this.db.from("kids_devices").select("*").eq("id", id).limit(1), "read device");
    if (!rows[0]) return null;
    const kids = await this.q(this.db.from("kids_device_children").select("child_id").eq("device_id", id), "read device kids");
    return fromRow(rows[0], kids.map((k) => k.child_id as string));
  }

  async list(householdId: string) {
    const rows = await this.q(this.db.from("kids_devices").select("*").eq("household_id", householdId), "read devices");
    const ids = rows.map((r) => r.id as string);
    const kids = ids.length ? await this.q(this.db.from("kids_device_children").select("device_id, child_id").in("device_id", ids), "read device kids") : [];
    return rows.map((r) => fromRow(r, kids.filter((k) => k.device_id === r.id).map((k) => k.child_id as string)));
  }

  async update(id: string, patch: Partial<KidsDevice>) {
    const row: Row = {};
    for (const [key, value] of Object.entries(patch)) if (COLUMNS[key]) row[COLUMNS[key]] = value;
    if (Object.keys(row).length) await this.q(this.db.from("kids_devices").update(row).eq("id", id), "update device");
  }

  async pinHash(householdId: string) {
    const rows = await this.q(this.db.from("household_kids_pins").select("pin_hash").eq("household_id", householdId).limit(1), "read PIN");
    return (rows[0]?.pin_hash as string | undefined) ?? null;
  }

  async setPinHash(householdId: string, hash: string, by: string) {
    await this.q(
      this.db.from("household_kids_pins").upsert({ household_id: householdId, pin_hash: hash, updated_by: by, updated_at: new Date().toISOString() }, { onConflict: "household_id" }),
      "save PIN",
    );
  }
}
