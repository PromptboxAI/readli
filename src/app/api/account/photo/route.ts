import { NextResponse } from "next/server";
import { MAX_PHOTO_BYTES, removePhoto, savePhoto } from "@/lib/account/photos";
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
    return NextResponse.json(await savePhoto(db, user, { bytes, consent: form?.get("consent") === "yes" }));
  });
}

/** Removes the photo; everyone sees initials again. */
export async function DELETE() {
  return withAccount(async ({ db, user }) => {
    await removePhoto(db, user.id);
    return NextResponse.json({ avatarUrl: null });
  });
}
