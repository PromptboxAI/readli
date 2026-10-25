/**
 * Private narration audio storage. Objects are never public: playback goes through a short-lived
 * signed URL issued after a permission check.
 */
export interface NarrationStorage {
  put(key: string, audio: ArrayBuffer, contentType: string): Promise<void>;
  /** The object, or only the bytes in `range` (inclusive; `end` null means to the end). `size` is always the whole object's. */
  get(key: string, range?: ByteRange): Promise<StoredAudio | null>;
  exists(key: string): Promise<boolean>;
  /** Keys of the objects directly inside the folder `prefix`. */
  list(prefix: string): Promise<string[]>;
  delete(keys: string[]): Promise<void>;
  bytesStored(): Promise<number>;
}

export interface ByteRange {
  start: number;
  end: number | null;
}

export interface StoredAudio {
  audio: ArrayBuffer;
  contentType: string;
  size: number;
}

function slice(audio: ArrayBuffer, range: ByteRange | undefined): ArrayBuffer {
  if (!range) return audio;
  return audio.slice(range.start, range.end === null ? audio.byteLength : Math.min(audio.byteLength, range.end + 1));
}

export class MemoryNarrationStorage implements NarrationStorage {
  private objects = new Map<string, { audio: ArrayBuffer; contentType: string }>();
  async put(key: string, audio: ArrayBuffer, contentType: string) {
    this.objects.set(key, { audio, contentType });
  }
  async get(key: string, range?: ByteRange) {
    const o = this.objects.get(key);
    return o ? { audio: slice(o.audio, range), contentType: o.contentType, size: o.audio.byteLength } : null;
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
  async list(prefix: string) {
    return [...this.objects.keys()].filter((k) => k.startsWith(`${prefix}/`) && !k.slice(prefix.length + 1).includes("/"));
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

  async get(key: string, range?: ByteRange) {
    const extra: Record<string, string> = range ? { range: `bytes=${range.start}-${range.end ?? ""}` } : {};
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, { headers: this.headers(extra) });
    if (res.status === 404 || res.status === 400) return null;
    const contentType = res.headers.get("content-type") ?? "audio/mpeg";
    // "bytes 0-99/1234" or, when the range starts past the end, "bytes */1234".
    const total = Number(res.headers.get("content-range")?.split("/")[1]);
    if (res.status === 416) return { audio: new ArrayBuffer(0), contentType, size: total || 0 };
    if (!res.ok) throw new Error(`narration read failed: ${res.status}`);
    const audio = await res.arrayBuffer();
    // A store that ignores Range sends the whole object; cut the range from it here.
    if (res.status === 206 && total) return { audio, contentType, size: total };
    return { audio: slice(audio, range), contentType, size: audio.byteLength };
  }

  async exists(key: string) {
    const res = await fetch(`${this.url}/storage/v1/object/info/${this.bucket}/${key}`, { headers: this.headers() });
    return res.ok;
  }

  async list(prefix: string) {
    const keys: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const res = await fetch(`${this.url}/storage/v1/object/list/${this.bucket}`, {
        method: "POST",
        headers: this.headers({ "content-type": "application/json" }),
        body: JSON.stringify({ prefix, limit: 1000, offset }),
      });
      if (!res.ok) throw new Error(`narration list failed: ${res.status}`);
      // Folders come back too, with a null id.
      const page = (await res.json()) as { name: string; id: string | null }[];
      keys.push(...page.filter((o) => o.id !== null).map((o) => `${prefix}/${o.name}`));
      if (page.length < 1000) return keys;
    }
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
