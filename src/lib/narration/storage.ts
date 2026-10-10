/**
 * Private narration audio storage. Objects are never public: playback goes through a short-lived
 * signed URL issued after a permission check.
 */
export interface NarrationStorage {
  put(key: string, audio: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ audio: ArrayBuffer; contentType: string } | null>;
  exists(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<void>;
  bytesStored(): Promise<number>;
}

export class MemoryNarrationStorage implements NarrationStorage {
  private objects = new Map<string, { audio: ArrayBuffer; contentType: string }>();
  async put(key: string, audio: ArrayBuffer, contentType: string) {
    this.objects.set(key, { audio, contentType });
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
  async delete(keys: string[]) {
    for (const k of keys) this.objects.delete(k);
  }
  async bytesStored() {
    let n = 0;
    for (const o of this.objects.values()) n += o.audio.byteLength;
    return n;
  }
}

/** Supabase Storage, private bucket "narrations"; reads with the service role only. */
export class SupabaseNarrationStorage implements NarrationStorage {
  constructor(
    private url: string,
    private serviceKey: string,
    private bucket = "narrations",
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  async put(key: string, audio: ArrayBuffer, contentType: string) {
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "content-type": contentType, "x-upsert": "true" }),
      body: audio,
    });
    if (!res.ok) throw new Error(`narration upload failed: ${res.status}`);
  }

  async get(key: string) {
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, { headers: this.headers() });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`narration read failed: ${res.status}`);
    return { audio: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "audio/mpeg" };
  }

  async exists(key: string) {
    const res = await fetch(`${this.url}/storage/v1/object/info/${this.bucket}/${key}`, { headers: this.headers() });
    return res.ok;
  }

  async delete(keys: string[]) {
    if (keys.length === 0) return;
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!res.ok) throw new Error(`narration delete failed: ${res.status}`);
  }

  async bytesStored() {
    return 0; // Reported from the storage dashboard / SQL in live mode.
  }
}
