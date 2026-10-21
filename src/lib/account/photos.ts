import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountError, PHOTOS_BUCKET } from "./privacy";

export { PHOTOS_BUCKET };

/**
 * A grown-up's profile photo. It is only stored once they agree it's a photo of themselves that
 * their family members may see, it lives in a private bucket, and it is shown only to people who
 * share a family with them, through a short-lived signed link.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const TYPES: { type: string; ext: string; magic: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", magic: (b) => [0x89, 0x50, 0x4e, 0x47].every((v, i) => b[i] === v) },
  {
    type: "image/webp",
    ext: "webp",
    magic: (b) => String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
  },
];

/** The image type from the file's own bytes, never from the name or the browser's claim. */
export function photoType(bytes: Uint8Array): { type: string; ext: string } | null {
  const hit = TYPES.find((t) => t.magic(bytes));
  return hit ? { type: hit.type, ext: hit.ext } : null;
}

export function photoUrl(userId: string, consentAt: string | null): string {
  return `/api/people/${userId}/photo?v=${encodeURIComponent(consentAt ?? "")}`;
}

async function profile(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from("adult_profiles").select("avatar_path, photo_consent_at").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`read photo: ${error.message}`);
  return (data ?? null) as { avatar_path: string | null; photo_consent_at: string | null } | null;
}

export async function savePhoto(db: SupabaseClient, user: { id: string; name: string }, input: { bytes: Uint8Array; consent: boolean }) {
  if (!input.consent) throw new AccountError(400, "consent_required", "Please confirm the photo is of you and that your family may see it.");
  if (input.bytes.byteLength === 0) throw new AccountError(400, "no_photo", "Please choose a photo.");
  if (input.bytes.byteLength > MAX_PHOTO_BYTES) throw new AccountError(413, "photo_too_big", "Please choose a photo smaller than 5 MB.");
  const kind = photoType(input.bytes);
  if (!kind) throw new AccountError(415, "photo_type", "Please choose a JPEG, PNG or WebP photo.");

  const oldPath = (await profile(db, user.id))?.avatar_path ?? null;
  const path = `${user.id}/${randomUUID()}.${kind.ext}`;
  const up = await db.storage.from(PHOTOS_BUCKET).upload(path, input.bytes, { contentType: kind.type, upsert: false });
  if (up.error) throw new Error(`upload photo: ${up.error.message}`);
  const consentAt = new Date().toISOString();
  const { error } = await db
    .from("adult_profiles")
    .upsert({ user_id: user.id, display_name: user.name, avatar_path: path, photo_consent_at: consentAt }, { onConflict: "user_id" });
  if (error) {
    await db.storage.from(PHOTOS_BUCKET).remove([path]);
    throw new Error(`save photo: ${error.message}`);
  }
  if (oldPath) await db.storage.from(PHOTOS_BUCKET).remove([oldPath]);
  return { avatarUrl: photoUrl(user.id, consentAt) };
}

export async function removePhoto(db: SupabaseClient, userId: string): Promise<void> {
  const before = await profile(db, userId);
  const { error } = await db.from("adult_profiles").update({ avatar_path: null, photo_consent_at: null }).eq("user_id", userId);
  if (error) throw new Error(`remove photo: ${error.message}`);
  if (before?.avatar_path) {
    const gone = await db.storage.from(PHOTOS_BUCKET).remove([before.avatar_path]);
    if (gone.error) throw new Error(`remove photo file: ${gone.error.message}`);
  }
}

/** Whether `viewer` may see `owner`'s photo: it's their own, or they are both active members of one family. */
export async function canSeePhoto(db: SupabaseClient, viewer: string, owner: string): Promise<boolean> {
  if (viewer === owner) return true;
  const { data, error } = await db.from("household_members").select("household_id, user_id, removed_at").in("user_id", [viewer, owner]);
  if (error) throw new Error(`read families: ${error.message}`);
  const live = ((data ?? []) as { household_id: string; user_id: string; removed_at: string | null }[]).filter((m) => m.removed_at === null);
  const viewerHomes = new Set(live.filter((m) => m.user_id === viewer).map((m) => m.household_id));
  return live.some((m) => m.user_id === owner && viewerHomes.has(m.household_id));
}

/** A short-lived signed link to the photo, or null when there is none to show this viewer. */
export async function signedPhotoUrl(db: SupabaseClient, viewer: string, owner: string): Promise<string | null> {
  if (!(await canSeePhoto(db, viewer, owner))) return null;
  const p = await profile(db, owner);
  if (!p?.avatar_path || !p.photo_consent_at) return null;
  const { data, error } = await db.storage.from(PHOTOS_BUCKET).createSignedUrl(p.avatar_path, 300);
  if (error || !data) {
    console.warn(`photo link for ${owner}: ${error?.message ?? "no link"}`);
    return null;
  }
  return data.signedUrl;
}
