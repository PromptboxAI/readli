import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MemoryNarrationStorage, type NarrationStorage } from "@/lib/narration/storage";
import type { AuditAction, ChildBookProgress, ChildVoiceApproval, FamilyState, HouseholdEntitlement, VoiceStatus } from "./model";
import { planConfig, type PlanConfig } from "./plan";
import type { FamilyStore } from "./service";

export function emptyFamilyState(): FamilyState {
  return {
    households: [],
    adults: [],
    members: [],
    children: [],
    voices: [],
    shares: [],
    approvals: [],
    audit: [],
    entitlements: [],
    slots: [],
    sessions: [],
    progress: [],
    favorites: [],
    libraries: [],
    segments: [],
    jobs: [],
    creditLots: [],
    ledger: [],
    usage: [],
    notifications: [],
    plays: [],
  };
}

const TINTS = ["bg-coral", "bg-sunshine", "bg-mint", "bg-sky", "bg-lavender"];

function tintFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

/**
 * A signed-in grown-up's families, kept in Supabase. It loads the households this person belongs to
 * (members, kids, guardians, plan, favourites, reading places, family voices, sharing, approvals,
 * narrator slots, listening and notices) and saves what a change touched. Voices are created by the
 * recording flow; this store only reads them. Narration stays with the preview for now.
 */
export class AccountFamilyStore implements FamilyStore {
  private state: FamilyState | null = null;
  private saved: FamilyState | null = null;

  constructor(
    private readonly db: SupabaseClient,
    private readonly user: { id: string; name: string },
    readonly plan: PlanConfig = planConfig(),
    readonly audio: NarrationStorage = new MemoryNarrationStorage(),
  ) {}

  private async q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
    return (data ?? []) as T;
  }

  async read(): Promise<FamilyState> {
    if (this.state) return this.state;
    const me = this.user.id;
    await this.q(
      this.db.from("adult_profiles").upsert({ user_id: me, display_name: this.user.name }, { onConflict: "user_id", ignoreDuplicates: true }),
      "save adult profile",
    );
    const mine = await this.q(this.db.from("household_members").select("household_id").eq("user_id", me), "read memberships");
    const homeIds = [...new Set(mine.map((m) => m.household_id as string))];
    const state = emptyFamilyState();

    if (homeIds.length > 0) {
      const [homes, members, children, entitlements] = await Promise.all([
        this.q(this.db.from("households").select("id, name").in("id", homeIds), "read households"),
        this.q(this.db.from("household_members").select("*").in("household_id", homeIds), "read members"),
        this.q(this.db.from("child_profiles").select("*").in("household_id", homeIds), "read kids"),
        this.q(this.db.from("household_entitlements").select("*").in("household_id", homeIds), "read plans"),
      ]);
      const childIds = children.map((c) => c.id as string);
      const [guardians, favorites, progress] = childIds.length
        ? await Promise.all([
            this.q(this.db.from("child_guardians").select("*").in("child_id", childIds), "read guardians"),
            this.q(this.db.from("child_favorites").select("child_id, book_slug").in("child_id", childIds), "read favourites"),
            this.q(this.db.from("child_book_progress").select("*").in("child_id", childIds), "read reading places"),
          ])
        : [[], [], []];
      const people = [...new Set(members.map((m) => m.user_id as string))];
      const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const [voices, shares, slots, sessions, notices, releases, approvals] = await Promise.all([
        this.q(this.db.from("voice_profiles").select("id, owner_id, version, status, created_at, deleted_at").in("owner_id", people).is("deleted_at", null), "read voices"),
        this.q(this.db.from("voice_household_shares").select("*").in("household_id", homeIds), "read sharing"),
        this.q(this.db.from("narrator_slot_assignments").select("*").in("household_id", homeIds), "read narrator slots"),
        this.q(this.db.from("listening_sessions").select("*").in("household_id", homeIds).is("ended_at", null), "read listening"),
        this.q(this.db.from("family_notifications").select("*").in("household_id", homeIds), "read notices"),
        // Only recent slot releases are read back; they set the monthly narrator change limit.
        this.q(
          this.db.from("permission_audit_log").select("*").in("household_id", homeIds).eq("action", "narrator_released").gte("at", since),
          "read narrator changes",
        ),
        childIds.length ? this.q(this.db.from("child_voice_approvals").select("*").in("child_id", childIds), "read approvals") : Promise.resolve([] as Row[]),
      ]);
      const profiles = await this.q(this.db.from("adult_profiles").select("user_id, display_name").in("user_id", people), "read people");

      state.households = homes.map((h) => ({ id: h.id as string, name: h.name as string }));
      state.members = members.map((m) => ({
        householdId: m.household_id as string,
        adultId: m.user_id as string,
        role: m.role as "guardian" | "member",
        joinedAt: m.joined_at as string,
        removedAt: str(m.removed_at),
      }));
      state.adults = people.map((id) => ({
        id,
        displayName: (profiles.find((p) => p.user_id === id)?.display_name as string) ?? "Family member",
        relationship: str(members.find((m) => m.user_id === id && m.relationship_label)?.relationship_label) ?? "",
        avatarUrl: null,
        tint: tintFor(id),
      }));
      state.children = children.map((c) => ({
        id: c.id as string,
        householdId: c.household_id as string,
        nickname: c.nickname as string,
        tint: str(c.icon) ?? tintFor(c.id as string),
        guardianIds: guardians.filter((g) => g.child_id === c.id && g.removed_at === null).map((g) => g.user_id as string),
        deletedAt: str(c.deleted_at),
      }));
      state.entitlements = entitlements.map((e) => ({
        id: e.id as string,
        householdId: e.household_id as string,
        source: e.source as HouseholdEntitlement["source"],
        status: e.status as HouseholdEntitlement["status"],
        extraNarratorSlots: Number(e.extra_narrator_slots ?? 0),
        extraStreams: Number(e.extra_streams ?? 0),
        startsAt: e.starts_at as string,
        endsAt: str(e.ends_at),
      }));
      state.favorites = favorites.map((f) => ({ childId: f.child_id as string, bookSlug: f.book_slug as string }));
      state.progress = progress.map((p) => ({
        childId: p.child_id as string,
        bookSlug: p.book_slug as string,
        sentence: Number(p.sentence ?? 0),
        voiceId: str(p.voice_id),
        updatedAt: p.updated_at as string,
      }));
      state.voices = voices.map((v) => ({
        id: v.id as string,
        ownerId: v.owner_id as string,
        version: Number(v.version ?? 1),
        status: v.status as VoiceStatus,
        createdAt: v.created_at as string,
        deletedAt: str(v.deleted_at),
      }));
      state.shares = shares.map((x) => ({
        id: x.id as string,
        voiceId: x.voice_id as string,
        householdId: x.household_id as string,
        grantedBy: x.granted_by as string,
        policyVersion: x.policy_version as string,
        grantedAt: x.granted_at as string,
        revokedAt: str(x.revoked_at),
        revokedBy: str(x.revoked_by),
      }));
      state.approvals = approvals.map((a) => ({
        id: a.id as string,
        voiceId: a.voice_id as string,
        childId: a.child_id as string,
        approvedBy: a.approved_by as string,
        approvedAt: a.approved_at as string,
        revokedAt: str(a.revoked_at),
        revokedBy: str(a.revoked_by),
        revokeReason: str(a.revoke_reason) as ChildVoiceApproval["revokeReason"],
      }));
      state.slots = slots.map((a) => ({
        id: a.id as string,
        householdId: a.household_id as string,
        voiceId: a.voice_id as string,
        activatedBy: a.activated_by as string,
        activatedAt: a.activated_at as string,
        releasedAt: str(a.released_at),
        releasedBy: str(a.released_by),
      }));
      state.sessions = sessions.map((x) => ({
        id: x.id as string,
        householdId: x.household_id as string,
        childId: x.child_id as string,
        startedAt: x.started_at as string,
        lastSeenAt: x.last_seen_at as string,
        endedAt: str(x.ended_at),
      }));
      state.notifications = notices
        .map((n) => ({ id: n.id as string, householdId: n.household_id as string, text: n.text as string, href: n.href as string, at: n.at as string, readAt: str(n.read_at) }))
        .sort((a, b) => a.at.localeCompare(b.at));
      state.audit = releases.map((e) => ({
        id: String(e.id),
        at: e.at as string,
        actor: e.actor as string,
        action: e.action as AuditAction,
        voiceId: str(e.voice_id),
        childId: str(e.child_id),
        householdId: str(e.household_id),
        detail: str(e.detail),
      }));
    }
    if (!state.adults.some((a) => a.id === me)) {
      state.adults.push({ id: me, displayName: this.user.name, relationship: "", avatarUrl: null, tint: tintFor(me) });
    }
    this.state = state;
    this.saved = structuredClone(state);
    return state;
  }

  async write(mutate: (state: FamilyState) => void): Promise<void> {
    const state = await this.read();
    mutate(state);
    await this.save(this.saved!, state);
    this.saved = structuredClone(state);
  }

  /** Saves the differences between two snapshots, parents before children. */
  private async save(before: FamilyState, after: FamilyState) {
    const db = this.db;
    for (const h of after.households) {
      const old = before.households.find((x) => x.id === h.id);
      if (!old) await this.q(db.from("households").insert({ id: h.id, name: h.name, created_by: this.user.id }), "create household");
      else if (old.name !== h.name) await this.q(db.from("households").update({ name: h.name }).eq("id", h.id), "rename household");
    }
    for (const m of after.members) {
      const old = before.members.find((x) => x.householdId === m.householdId && x.adultId === m.adultId);
      const relationship = after.adults.find((a) => a.id === m.adultId)?.relationship || null;
      if (!old) {
        await this.q(
          db.from("household_members").insert({ household_id: m.householdId, user_id: m.adultId, role: m.role, relationship_label: relationship, joined_at: m.joinedAt }),
          "add member",
        );
      } else if (old.role !== m.role || old.removedAt !== m.removedAt) {
        await this.q(
          db.from("household_members").update({ role: m.role, removed_at: m.removedAt }).eq("household_id", m.householdId).eq("user_id", m.adultId),
          "update member",
        );
      }
    }
    for (const e of after.entitlements) {
      const old = before.entitlements.find((x) => x.id === e.id);
      const row = { status: e.status, extra_narrator_slots: e.extraNarratorSlots, extra_streams: e.extraStreams, ends_at: e.endsAt };
      if (!old) {
        await this.q(db.from("household_entitlements").insert({ id: e.id, household_id: e.householdId, source: e.source, starts_at: e.startsAt, ...row }), "add plan");
      } else if (JSON.stringify(old) !== JSON.stringify(e)) {
        await this.q(db.from("household_entitlements").update(row).eq("id", e.id), "update plan");
      }
    }
    for (const c of after.children) {
      const old = before.children.find((x) => x.id === c.id);
      if (!old) {
        await this.q(db.from("child_profiles").insert({ id: c.id, household_id: c.householdId, nickname: c.nickname, icon: c.tint, deleted_at: c.deletedAt }), "add kid");
      } else if (old.nickname !== c.nickname || old.tint !== c.tint || old.deletedAt !== c.deletedAt) {
        await this.q(db.from("child_profiles").update({ nickname: c.nickname, icon: c.tint, deleted_at: c.deletedAt }).eq("id", c.id), "update kid");
      }
      const was = old?.guardianIds ?? [];
      const added = c.guardianIds.filter((g) => !was.includes(g));
      const removed = was.filter((g) => !c.guardianIds.includes(g));
      if (added.length) {
        await this.q(
          db.from("child_guardians").upsert(added.map((user_id) => ({ child_id: c.id, user_id, removed_at: null })), { onConflict: "child_id,user_id" }),
          "add guardian",
        );
      }
      for (const user_id of removed) {
        await this.q(db.from("child_guardians").update({ removed_at: new Date().toISOString() }).eq("child_id", c.id).eq("user_id", user_id), "remove guardian");
      }
    }
    const fav = (f: { childId: string; bookSlug: string }) => `${f.childId}|${f.bookSlug}`;
    const favBefore = new Set(before.favorites.map(fav));
    const favAfter = new Set(after.favorites.map(fav));
    const newFavs = after.favorites.filter((f) => !favBefore.has(fav(f)));
    if (newFavs.length) {
      await this.q(db.from("child_favorites").upsert(newFavs.map((f) => ({ child_id: f.childId, book_slug: f.bookSlug })), { onConflict: "child_id,book_slug" }), "save favourite");
    }
    for (const f of before.favorites.filter((x) => !favAfter.has(fav(x)))) {
      await this.q(db.from("child_favorites").delete().eq("child_id", f.childId).eq("book_slug", f.bookSlug), "remove favourite");
    }
    const changed = (p: ChildBookProgress) => {
      const old = before.progress.find((x) => x.childId === p.childId && x.bookSlug === p.bookSlug);
      return !old || old.sentence !== p.sentence || old.voiceId !== p.voiceId;
    };
    const places = after.progress.filter(changed);
    if (places.length) {
      await this.q(
        db
          .from("child_book_progress")
          .upsert(
            places.map((p) => ({ child_id: p.childId, book_slug: p.bookSlug, sentence: p.sentence, voice_id: p.voiceId, updated_at: p.updatedAt })),
            { onConflict: "child_id,book_slug" },
          ),
        "save reading place",
      );
    }

    // Voice rows come from the recording flow; a change here is only a status or deletion.
    for (const v of after.voices) {
      const old = before.voices.find((x) => x.id === v.id);
      if (old && (old.status !== v.status || old.deletedAt !== v.deletedAt)) {
        await this.q(db.from("voice_profiles").update({ status: v.status, deleted_at: v.deletedAt }).eq("id", v.id), "update voice");
      }
    }
    // Order matters to the database guards: a share before its slot, a slot before an approval,
    // and within each table, endings before the new row that replaces them.
    await this.sync(before.shares, after.shares, "voice_household_shares", "share voice", (x) => ({
      voice_id: x.voiceId,
      household_id: x.householdId,
      granted_by: x.grantedBy,
      policy_version: x.policyVersion,
      granted_at: x.grantedAt,
      revoked_at: x.revokedAt,
      revoked_by: x.revokedBy,
    }), (x) => ({ revoked_at: x.revokedAt, revoked_by: x.revokedBy }));
    await this.sync(before.slots, after.slots, "narrator_slot_assignments", "save narrator slot", (x) => ({
      household_id: x.householdId,
      voice_id: x.voiceId,
      activated_by: x.activatedBy,
      activated_at: x.activatedAt,
      released_at: x.releasedAt,
      released_by: x.releasedBy,
    }), (x) => ({ released_at: x.releasedAt, released_by: x.releasedBy }));
    await this.sync(before.approvals, after.approvals, "child_voice_approvals", "save storyteller approval", (x) => ({
      voice_id: x.voiceId,
      child_id: x.childId,
      approved_by: x.approvedBy,
      approved_at: x.approvedAt,
      revoked_at: x.revokedAt,
      revoked_by: x.revokedBy,
      revoke_reason: x.revokeReason,
    }), (x) => ({ revoked_at: x.revokedAt, revoked_by: x.revokedBy, revoke_reason: x.revokeReason }));
    await this.sync(before.sessions, after.sessions, "listening_sessions", "save listening", (x) => ({
      household_id: x.householdId,
      child_id: x.childId,
      started_at: x.startedAt,
      last_seen_at: x.lastSeenAt,
      ended_at: x.endedAt,
    }), (x) => ({ last_seen_at: x.lastSeenAt, ended_at: x.endedAt }));
    await this.sync(before.notifications, after.notifications, "family_notifications", "save notice", (x) => ({
      household_id: x.householdId,
      text: x.text,
      href: x.href,
      at: x.at,
      read_at: x.readAt,
    }), (x) => ({ read_at: x.readAt }));

    // The audit log is append-only; the database numbers its rows.
    const logged = new Set(before.audit.map((e) => e.id));
    const events = after.audit.filter((e) => !logged.has(e.id));
    if (events.length) {
      await this.q(
        db.from("permission_audit_log").insert(
          events.map((e) => ({ at: e.at, actor: e.actor, action: e.action, voice_id: e.voiceId, child_id: e.childId, household_id: e.householdId, detail: e.detail })),
        ),
        "write audit log",
      );
    }
  }

  /** Saves rows keyed by id: changed rows first, then new ones. */
  private async sync<T extends { id: string }>(before: T[], after: T[], table: string, what: string, insert: (x: T) => Row, update: (x: T) => Row) {
    const old = new Map(before.map((x) => [x.id, x]));
    for (const x of after) {
      const was = old.get(x.id);
      if (was && JSON.stringify(update(was)) !== JSON.stringify(update(x))) await this.q(this.db.from(table).update(update(x)).eq("id", x.id), what);
    }
    const added = after.filter((x) => !old.has(x.id));
    if (added.length) await this.q(this.db.from(table).insert(added.map((x) => ({ id: x.id, ...insert(x) }))), what);
  }
}

export function accountDb(env: NodeJS.ProcessEnv = process.env): SupabaseClient | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
