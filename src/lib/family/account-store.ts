import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MemoryNarrationStorage, type NarrationStorage } from "@/lib/narration/storage";
import type { ChildBookProgress, FamilyState, HouseholdEntitlement } from "./model";
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
 * (members, kids, guardians, plan, favourites and reading places) and saves what a change touched.
 * Voices, sharing, narrator slots and narration stay with the preview for now; this store starts them
 * empty and doesn't save them yet.
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
            places.map((p) => ({ child_id: p.childId, book_slug: p.bookSlug, sentence: p.sentence, voice_id: null, updated_at: p.updatedAt })),
            { onConflict: "child_id,book_slug" },
          ),
        "save reading place",
      );
    }
  }
}

export function accountDb(env: NodeJS.ProcessEnv = process.env): SupabaseClient | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
