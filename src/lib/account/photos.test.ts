import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { canSeePhoto, photoType, removePhoto, savePhoto, signedPhotoUrl } from "./photos";
import { AccountError } from "./privacy";

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>) {
  const stored = new Set<string>();
  const t = (name: string) => (tables[name] ??= []);
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let update: Row | null = null;
    const hits = () => t(name).filter((r) => filters.every((f) => f(r)));
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      update: (values: Row) => ((update = values), q),
      maybeSingle: async () => ({ data: hits()[0] ?? null, error: null }),
      upsert: async (row: Row) => {
        const old = t(name).find((r) => r.user_id === row.user_id);
        if (old) Object.assign(old, row);
        else t(name).push({ ...row });
        return { data: null, error: null };
      },
      then: (resolve: (v: unknown) => void) => {
        if (update) for (const r of hits()) Object.assign(r, update);
        resolve({ data: update ? null : hits(), error: null });
      },
    };
    return q;
  };
  const db = {
    from,
    storage: {
      from: () => ({
        upload: async (path: string) => (stored.add(path), { data: { path }, error: null }),
        remove: async (keys: string[]) => (keys.forEach((k) => stored.delete(k)), { data: [], error: null }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }),
      }),
    },
  } as unknown as SupabaseClient;
  return { db, tables, stored };
}

const ME = { id: "me", name: "Sara" };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("profile photos", () => {
  it("knows an image by its bytes, not its name", () => {
    expect(photoType(JPEG)).toEqual({ type: "image/jpeg", ext: "jpg" });
    expect(photoType(PNG)).toEqual({ type: "image/png", ext: "png" });
    expect(photoType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toEqual({ type: "image/webp", ext: "webp" });
    expect(photoType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("stores nothing without consent", async () => {
    const { db, stored, tables } = fakeDb({ adult_profiles: [] });
    await expect(savePhoto(db, ME, { bytes: JPEG, consent: false })).rejects.toBeInstanceOf(AccountError);
    expect(stored.size).toBe(0);
    expect(tables.adult_profiles).toEqual([]);
  });

  it("rejects files that aren't photos", async () => {
    const { db, stored } = fakeDb({ adult_profiles: [] });
    await expect(savePhoto(db, ME, { bytes: new TextEncoder().encode("hello"), consent: true })).rejects.toMatchObject({ code: "photo_type" });
    expect(stored.size).toBe(0);
  });

  it("saves the photo with its consent time, replaces the old one, and removes it", async () => {
    const { db, stored, tables } = fakeDb({ adult_profiles: [{ user_id: "me", display_name: "Sara" }] });
    const first = await savePhoto(db, ME, { bytes: JPEG, consent: true });
    const firstPath = tables.adult_profiles![0]!.avatar_path as string;
    expect(firstPath).toMatch(/^me\/.+\.jpg$/);
    expect(tables.adult_profiles![0]!.photo_consent_at).toEqual(expect.any(String));
    expect(first.avatarUrl).toMatch(/^\/api\/people\/me\/photo\?v=/);

    await savePhoto(db, ME, { bytes: PNG, consent: true });
    expect(stored.has(firstPath)).toBe(false);
    expect([...stored]).toEqual([tables.adult_profiles![0]!.avatar_path]);

    await removePhoto(db, "me");
    expect(stored.size).toBe(0);
    expect(tables.adult_profiles![0]).toMatchObject({ avatar_path: null, photo_consent_at: null });
  });

  it("shows a photo only to its owner and people in one of their families", async () => {
    const { db } = fakeDb({
      adult_profiles: [{ user_id: "me", avatar_path: "me/a.jpg", photo_consent_at: "2026-10-11" }],
      household_members: [
        { household_id: "home", user_id: "me", removed_at: null },
        { household_id: "home", user_id: "grandma", removed_at: null },
        { household_id: "home", user_id: "left", removed_at: "2026-10-01" },
        { household_id: "other", user_id: "stranger", removed_at: null },
      ],
    });
    expect(await canSeePhoto(db, "me", "me")).toBe(true);
    expect(await canSeePhoto(db, "grandma", "me")).toBe(true);
    expect(await canSeePhoto(db, "left", "me")).toBe(false);
    expect(await canSeePhoto(db, "stranger", "me")).toBe(false);
    expect(await signedPhotoUrl(db, "grandma", "me")).toBe("https://signed.example/me/a.jpg");
    expect(await signedPhotoUrl(db, "stranger", "me")).toBeNull();
  });
});
