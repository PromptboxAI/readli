import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import type { Actor, FamilyState } from "./model";
import { childVoiceAccess, storytellerStatus } from "./permissions";
import {
  authorizeAssetPlayback,
  authorizeNarration,
  MemoryFamilyStore,
  narratorsFor,
  PermissionError,
  setChildApprovals,
  setHouseholdShare,
} from "./service";
import { decodeSession, encodeSession } from "./session";

/**
 * Amendment 002 §8 acceptance tests. Aunt Priya plays the new storyteller: her voice starts
 * recorded but unshared, so every step below is the only thing that changes.
 */
const mom: Actor = { kind: "adult", adultId: "sara" };
const priya: Actor = { kind: "adult", adultId: "priya" };
const june: Actor = { kind: "adult", adultId: "june" };
const maya: Actor = { kind: "child", childId: "maya" };
const leo: Actor = { kind: "child", childId: "leo" };
const VOICE = "voice-priya";
const policy = "test-policy";

let tick = Date.parse("2026-10-10T00:00:00Z");
const clock = () => new Date((tick += 1000));

function freshFamily() {
  const state: FamilyState = demoFamilyState();
  // Priya has just recorded: no share, no approvals.
  state.shares = state.shares.filter((s) => s.voiceId !== VOICE);
  return { state, store: new MemoryFamilyStore(state) };
}

const names = async (store: MemoryFamilyStore, actor: Actor, childId: string) =>
  (await narratorsFor(store, actor, childId)).map((n) => n.voiceId);

const share = (store: MemoryFamilyStore, shared: boolean) =>
  setHouseholdShare(store, priya, { voiceId: VOICE, householdId: DEMO_HOUSEHOLD_ID, shared, policyVersion: policy }, clock);

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  if (code) expect((err as PermissionError).code).toBe(code);
}

describe("family voice permissions (Amendment 002 acceptance criteria)", () => {
  it("1. a newly recorded voice is invisible to children", async () => {
    const { state, store } = freshFamily();
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
    expect(await names(store, leo, "leo")).not.toContain(VOICE);
    expect(childVoiceAccess(state, "maya", VOICE)).toEqual({ allowed: false, reason: "not_shared_by_owner" });
    expect(storytellerStatus(state, "maya", VOICE)).toBe("waiting_for_owner");
  });

  it("2. household sharing alone does not expose the voice to children", async () => {
    const { state, store } = freshFamily();
    await share(store, true);
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
    expect(childVoiceAccess(state, "maya", VOICE).reason).toBe("not_approved_for_child");
    expect(storytellerStatus(state, "maya", VOICE)).toBe("available");
  });

  it("3. parent approval without the owner's authorization grants nothing", async () => {
    const { state, store } = freshFamily();
    await rejects(setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: true }], clock), 409, "waiting_for_owner");
    // Even an approval row written straight into storage is ignored without the owner's share.
    state.approvals.push({ id: "forged", voiceId: VOICE, childId: "maya", approvedBy: "sara", approvedAt: clock().toISOString(), revokedAt: null, revokedBy: null, revokeReason: null });
    expect(childVoiceAccess(state, "maya", VOICE).allowed).toBe(false);
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
  });

  it("4. both authorizations make the voice appear", async () => {
    const { store } = freshFamily();
    await share(store, true);
    await setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: true }], clock);
    expect(await names(store, maya, "maya")).toContain(VOICE);
    await expect(authorizeNarration(store, maya, { childId: "maya", voiceId: VOICE, bookSlug: "winnie-the-pooh", sentence: 0 }, clock)).resolves.toMatchObject({ voiceId: VOICE });
  });

  it("5. removing either authorization blocks access, including audio made earlier", async () => {
    const { state, store } = freshFamily();
    await share(store, true);
    await setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: true }], clock);
    const asset = await authorizeNarration(store, maya, { childId: "maya", voiceId: VOICE, bookSlug: "winnie-the-pooh", sentence: 0 }, clock);

    // Guardian removes it.
    await setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: false }], clock);
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
    await rejects(authorizeAssetPlayback(store, maya, asset.id), 403);

    // Guardian approves again, then the owner revokes.
    await setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: true }], clock);
    await expect(authorizeAssetPlayback(store, maya, asset.id)).resolves.toBeTruthy();
    await share(store, false);
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
    await rejects(authorizeAssetPlayback(store, maya, asset.id), 403);
    await rejects(authorizeNarration(store, maya, { childId: "maya", voiceId: VOICE, bookSlug: "winnie-the-pooh", sentence: 0 }, clock), 403);

    // Sharing again starts disabled for every child; old approvals never come back.
    await share(store, true);
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
    expect(storytellerStatus(state, "maya", VOICE)).toBe("available");

    // Every change is in the audit log.
    expect(state.audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(["voice_shared", "child_voice_approved", "child_voice_removed", "voice_unshared", "narration_authorized", "narration_denied"]),
    );
  });

  it("6. children, and adults who aren't the guardian or owner, cannot change approvals", async () => {
    const { store } = freshFamily();
    await share(store, true);
    await rejects(setChildApprovals(store, maya, "maya", [{ voiceId: VOICE, approved: true }], clock), 403, "adults_only");
    await rejects(setHouseholdShare(store, maya, { voiceId: VOICE, householdId: DEMO_HOUSEHOLD_ID, shared: false, policyVersion: policy }), 403, "adults_only");
    await rejects(setChildApprovals(store, june, "maya", [{ voiceId: VOICE, approved: true }], clock), 403, "not_guardian");
    await rejects(setHouseholdShare(store, mom, { voiceId: VOICE, householdId: DEMO_HOUSEHOLD_ID, shared: false, policyVersion: policy }), 403, "not_owner");
    await rejects(setChildApprovals(store, null, "maya", [{ voiceId: VOICE, approved: true }], clock), 401);
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
  });

  it("7. each child's permissions are independent", async () => {
    const { store } = freshFamily();
    await share(store, true);
    await setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: true }], clock);
    expect(await names(store, maya, "maya")).toContain(VOICE);
    expect(await names(store, leo, "leo")).not.toContain(VOICE);
    await setChildApprovals(store, mom, "leo", [{ voiceId: VOICE, approved: true }], clock);
    await setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: false }], clock);
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
    expect(await names(store, leo, "leo")).toContain(VOICE);
  });

  it("8. direct requests for unapproved voices, or another child's audio, are refused", async () => {
    const { store } = freshFamily();
    // Grandpa Lou recorded but never shared; Nana Rose is approved for Leo only.
    await rejects(authorizeNarration(store, maya, { childId: "maya", voiceId: "voice-lou", bookSlug: "winnie-the-pooh", sentence: 0 }, clock), 403, "voice_not_available");
    await rejects(authorizeNarration(store, maya, { childId: "maya", voiceId: "voice-rose", bookSlug: "winnie-the-pooh", sentence: 0 }, clock), 403);
    // A child can't ask on behalf of a sibling.
    await rejects(authorizeNarration(store, maya, { childId: "leo", voiceId: "voice-rose", bookSlug: "winnie-the-pooh", sentence: 0 }, clock), 403, "not_this_child");
    await rejects(narratorsFor(store, maya, "leo"), 403);
    const leosAudio = await authorizeNarration(store, leo, { childId: "leo", voiceId: "voice-rose", bookSlug: "winnie-the-pooh", sentence: 0 }, clock);
    await rejects(authorizeAssetPlayback(store, maya, leosAudio.id), 403);
    await rejects(authorizeAssetPlayback(store, maya, "made-up-id"), 403);
  });

  it("a parent can approve several storytellers at once, and approvals made by a former guardian lapse", async () => {
    const { state, store } = freshFamily();
    await share(store, true);
    await setChildApprovals(store, mom, "maya", [{ voiceId: VOICE, approved: true }, { voiceId: "voice-rose", approved: true }], clock);
    expect(await names(store, maya, "maya")).toEqual(expect.arrayContaining([VOICE, "voice-rose"]));
    state.members.find((m) => m.adultId === "sara")!.removedAt = clock().toISOString();
    expect(await names(store, maya, "maya")).not.toContain(VOICE);
  });
});

describe("family preview session cookie", () => {
  it("round-trips and rejects tampering", () => {
    const value = encodeSession({ sandbox: "abc", actor: maya }, "k");
    expect(decodeSession(value, "k")).toEqual({ sandbox: "abc", actor: maya });
    expect(decodeSession(value.replace("child:maya", "adult:sara"), "k")).toBeNull();
    expect(decodeSession(value, "other-key")).toBeNull();
    expect(decodeSession("nonsense", "k")).toBeNull();
  });
});
