import { NextResponse } from "next/server";
import { MAX_PHOTO_BYTES, removePhoto, savePhoto } from "@/lib/account/photos";
import { AccountError } from "@/lib/account/privacy";
import { withAccount } from "@/lib/account/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Adds or replaces the signed-in grown-up's profile photo, with their consent. */
export async function POST(req: Request) {
  return withAccount(async ({ db, user }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof Blob)) return fail(400, "no_photo", "Please choose a photo.");
    if (file.size > MAX_PHOTO_BYTES) return fail(413, "photo_too_big", "Please choose a photo smaller than 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      return NextResponse.json(await savePhoto(db, user, { bytes, consent: form?.get("consent") === "yes" }));
    } catch (err) {
      if (err instanceof AccountError) throw err;
      // Storage or database trouble: log the cause for us, and give the grown-up a clear answer.
      console.error("profile photo save failed", err instanceof Error ? err.message : err);
      return fail(500, "photo_save_failed", "We couldn't save your photo just now. Please try again in a moment.");
    }
  });
}

/** Removes the photo; everyone sees initials again. */
export async function DELETE() {
  return withAccount(async ({ db, user }) => {
    await removePhoto(db, user.id);
    return NextResponse.json({ avatarUrl: null });
  });
}
