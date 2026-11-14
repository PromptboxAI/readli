"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/supabase";
import { AccountError, updateDisplayName } from "./privacy";
import { signedInAccount } from "./server";

/**
 * Saves the signed-in grown-up's name and, inside a walkthrough, goes on to the next step in the same
 * request: the next page comes back with the save, instead of the browser asking for it afterwards.
 */
export async function saveNameAndContinue(displayName: string, next: string): Promise<{ error: string }> {
  const account = await signedInAccount();
  if (!account) return { error: "Please sign in as a grown-up to save your name." };
  try {
    await updateDisplayName(account.db, account.user.id, displayName);
  } catch (err) {
    if (err instanceof AccountError) return { error: err.userMessage };
    console.error("save name", err);
    return { error: "We couldn't save your name. Please try again." };
  }
  redirect(safeNext(next, "/home"));
}
