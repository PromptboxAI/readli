import { createClient } from "@supabase/supabase-js";
import { MAX_GUEST_PREVIEWS, previewsAllowed, type ServerConfig } from "./config";

/**
 * Admin-editable demo settings (demo_settings, one row). Until that migration runs, or when it
 * can't be read, the GUEST_PREVIEWS_ALLOWED setting (default 4) applies.
 */
const g = globalThis as typeof globalThis & { __readliDemoPreviews?: number };

function db(config: ServerConfig) {
  if (!config.supabaseUrl || !config.supabaseServiceKey) return null;
  return createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function guestPreviewsAllowed(config: ServerConfig): Promise<number> {
  if (config.mode === "stub") return g.__readliDemoPreviews ?? config.guestPreviewsAllowed;
  const client = db(config);
  if (!client) return config.guestPreviewsAllowed;
  const { data, error } = await client.from("demo_settings").select("previews_allowed").eq("id", true).maybeSingle();
  if (error || !data) return config.guestPreviewsAllowed;
  return previewsAllowed(data.previews_allowed);
}

export async function saveGuestPreviewsAllowed(config: ServerConfig, value: number, adminId: string): Promise<number> {
  const n = Math.round(value);
  if (!Number.isFinite(n) || n < 1 || n > MAX_GUEST_PREVIEWS) throw new Error(`Choose between 1 and ${MAX_GUEST_PREVIEWS} stories.`);
  if (config.mode === "stub") return (g.__readliDemoPreviews = n);
  const client = db(config);
  if (!client) throw new Error("The database isn't connected here.");
  const { error } = await client
    .from("demo_settings")
    .upsert({ id: true, previews_allowed: n, updated_at: new Date().toISOString(), updated_by: adminId }, { onConflict: "id" });
  if (error) throw new Error(`Couldn't save the demo setting: ${error.message}`);
  return n;
}
