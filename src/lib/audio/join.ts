/**
 * Joins stored sentence clips into one continuous track without re-encoding, and reports exactly where
 * each clip starts. MP3 clips (what ElevenLabs returns) are joined frame by frame; WAV clips (the
 * stand-in tone) are joined sample by sample. Times come from counting frames or samples, never from
 * estimates, so a read-along highlight driven by the track's clock lands on the right sentence.
 */

export interface Clip {
  audio: ArrayBuffer;
  /** Silence to put before this clip, such as the pause before "The End.". */
  pauseBeforeMs?: number;
}

export interface JoinedTrack {
  audio: Uint8Array;
  contentType: string;
  durationMs: number;
  /** Where each clip starts and how long it lasts, in the order given. */
  clips: { startMs: number; durationMs: number }[];
}

export class JoinError extends Error {}

// ---------------------------------------------------------------------------
// MP3 (MPEG audio Layer III)
// ---------------------------------------------------------------------------

const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

interface FrameHeader {
  /** 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5. */
  version: number;
  sampleRate: number;
  samples: number;
  length: number;
  mono: boolean;
  crc: boolean;
}

/** The Layer III frame header at `at`, or null when there isn't one. */
export function frameHeader(b: Uint8Array, at: number): FrameHeader | null {
  if (at + 4 > b.length || b[at] !== 0xff || (b[at + 1]! & 0xe0) !== 0xe0) return null;
  const version = (b[at + 1]! >> 3) & 3;
  const layer = (b[at + 1]! >> 1) & 3;
  const bitrateIndex = b[at + 2]! >> 4;
  const rateIndex = (b[at + 2]! >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const sampleRate = RATES[version]![rateIndex]!;
  const bitrate = (version === 3 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex]! * 1000;
  const samples = version === 3 ? 1152 : 576;
  const padding = (b[at + 2]! >> 1) & 1;
  const length = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
  return { version, sampleRate, samples, length, mono: b[at + 3]! >> 6 === 3, crc: (b[at + 1]! & 1) === 0 };
}

function sideInfoBytes(h: FrameHeader) {
  return h.version === 3 ? (h.mono ? 17 : 32) : h.mono ? 9 : 17;
}

/** An encoder's Xing/Info/VBRI summary frame: valid MPEG audio, but metadata rather than sound. */
function isSummaryFrame(b: Uint8Array, at: number, h: FrameHeader) {
  const tag = (o: number) => String.fromCharCode(...b.subarray(o, o + 4));
  const xing = at + 4 + (h.crc ? 2 : 0) + sideInfoBytes(h);
  return tag(xing) === "Xing" || tag(xing) === "Info" || tag(at + 36) === "VBRI";
}

interface Mp3Clip {
  frames: Uint8Array[];
  samples: number;
  sampleRate: number;
  /** Frames of different clips join only when this matches. */
  format: string;
  first: Uint8Array;
}

function parseMp3(audio: ArrayBuffer): Mp3Clip {
  const b = new Uint8Array(audio);
  let at = 0;
  // ID3v2 tag: "ID3", version, flags, then a 28-bit size; a footer adds 10 more bytes.
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b.length >= 10) {
    const size = (b[6]! << 21) | (b[7]! << 14) | (b[8]! << 7) | b[9]!;
    at = 10 + size + (b[5]! & 0x10 ? 10 : 0);
  }
  // ID3v1 tag: the last 128 bytes, starting "TAG".
  const end = b.length >= 128 && b[b.length - 128] === 0x54 && b[b.length - 127] === 0x41 && b[b.length - 126] === 0x47 ? b.length - 128 : b.length;
  const frames: Uint8Array[] = [];
  let samples = 0;
  let format = "";
  let sampleRate = 0;
  while (at < end) {
    const h = frameHeader(b, at);
    if (!h || at + h.length > end) {
      if (h) break; // a cut-off last frame
      at += 1; // stray bytes between frames
      continue;
    }
    const f = `${h.version}:${h.sampleRate}:${h.mono ? 1 : 2}`;
    if (format && f !== format) throw new JoinError("an MP3 clip changes format partway through");
    if (!(frames.length === 0 && isSummaryFrame(b, at, h))) {
      frames.push(b.subarray(at, at + h.length));
      samples += h.samples;
    }
    format = f;
    sampleRate = h.sampleRate;
    at += h.length;
  }
  if (frames.length === 0) throw new JoinError("an MP3 clip has no audio frames");
  return { frames, samples, sampleRate, format, first: frames[0]! };
}

/**
 * One frame of digital silence shaped like `like`: the same version, rate, bitrate and channels, no
 * padding or CRC, and all-zero side information, so it decodes to zeros and depends on no other frame.
 */
function silentFrame(like: Uint8Array): Uint8Array {
  const header = new Uint8Array(like.subarray(0, 4));
  header[1] = header[1]! | 1; // no CRC
  header[2] = header[2]! & ~0x02; // no padding
  const h = frameHeader(header, 0)!;
  const frame = new Uint8Array(h.length);
  frame.set(header);
  return frame;
}

function joinMp3(clips: Clip[]): JoinedTrack {
  const parsed = clips.map((c) => parseMp3(c.audio));
  const format = parsed[0]!.format;
  if (parsed.some((p) => p.format !== format)) throw new JoinError("the clips were recorded in different MP3 formats");
  const rate = parsed[0]!.sampleRate;
  const perFrame = frameHeader(parsed[0]!.first, 0)!.samples;
  const parts: Uint8Array[] = [];
  const out: JoinedTrack["clips"] = [];
  let samples = 0;
  parsed.forEach((p, i) => {
    const pause = clips[i]!.pauseBeforeMs ?? 0;
    if (pause > 0) {
      const silence = silentFrame(p.first);
      for (let n = Math.round((pause / 1000) * (rate / perFrame)); n > 0; n--) {
        parts.push(silence);
        samples += perFrame;
      }
    }
    out.push({ startMs: (samples / rate) * 1000, durationMs: (p.samples / rate) * 1000 });
    parts.push(...p.frames);
    samples += p.samples;
  });
  return { audio: concat(parts), contentType: "audio/mpeg", durationMs: (samples / rate) * 1000, clips: out };
}

// ---------------------------------------------------------------------------
// WAV (PCM)
// ---------------------------------------------------------------------------

interface WavClip {
  fmt: Uint8Array;
  data: Uint8Array;
  byteRate: number;
  blockAlign: number;
}

function parseWav(audio: ArrayBuffer): WavClip {
  const v = new DataView(audio);
  const b = new Uint8Array(audio);
  const tag = (o: number) => String.fromCharCode(...b.subarray(o, o + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new JoinError("a WAV clip has no RIFF header");
  let fmt: Uint8Array | null = null;
  let data: Uint8Array | null = null;
  for (let at = 12; at + 8 <= b.length; ) {
    const size = v.getUint32(at + 4, true);
    const body = b.subarray(at + 8, Math.min(b.length, at + 8 + size));
    if (tag(at) === "fmt ") fmt = body;
    if (tag(at) === "data") data = body;
    at += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.length < 16) throw new JoinError("a WAV clip is missing its format or data");
  const f = new DataView(fmt.buffer, fmt.byteOffset, fmt.length);
  if (f.getUint16(0, true) !== 1) throw new JoinError("only PCM WAV clips can be joined");
  const blockAlign = f.getUint16(12, true);
  return { fmt: fmt.subarray(0, 16), data: data.subarray(0, data.length - (data.length % blockAlign)), byteRate: f.getUint32(8, true), blockAlign };
}

function joinWav(clips: Clip[]): JoinedTrack {
  const parsed = clips.map((c) => parseWav(c.audio));
  const fmt = parsed[0]!.fmt;
  if (parsed.some((p) => p.fmt.some((x, i) => x !== fmt[i]))) throw new JoinError("the clips were recorded in different WAV formats");
  const { byteRate, blockAlign } = parsed[0]!;
  const parts: Uint8Array[] = [];
  const out: JoinedTrack["clips"] = [];
  let bytes = 0;
  parsed.forEach((p, i) => {
    const pause = clips[i]!.pauseBeforeMs ?? 0;
    if (pause > 0) {
      const silence = new Uint8Array(Math.round((pause / 1000) * (byteRate / blockAlign)) * blockAlign);
      parts.push(silence);
      bytes += silence.length;
    }
    out.push({ startMs: (bytes / byteRate) * 1000, durationMs: (p.data.length / byteRate) * 1000 });
    parts.push(p.data);
    bytes += p.data.length;
  });
  const header = new Uint8Array(44);
  const h = new DataView(header.buffer);
  header.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  h.setUint32(4, 36 + bytes, true);
  header.set([..."WAVEfmt "].map((c) => c.charCodeAt(0)), 8);
  h.setUint32(16, 16, true);
  header.set(fmt, 20);
  header.set([..."data"].map((c) => c.charCodeAt(0)), 36);
  h.setUint32(40, bytes, true);
  return { audio: concat([header, ...parts]), contentType: "audio/wav", durationMs: (bytes / byteRate) * 1000, clips: out };
}

// ---------------------------------------------------------------------------

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function isWav(audio: ArrayBuffer) {
  const b = new Uint8Array(audio, 0, Math.min(4, audio.byteLength));
  return String.fromCharCode(...b) === "RIFF";
}

/** Joins clips of one kind (all MP3 or all WAV) into one track. Throws JoinError when they can't be joined as they are. */
export function joinClips(clips: Clip[]): JoinedTrack {
  if (clips.length === 0) throw new JoinError("there are no clips to join");
  const wav = clips.map((c) => isWav(c.audio));
  if (wav.some((w) => w !== wav[0])) throw new JoinError("the clips mix MP3 and WAV audio");
  return wav[0] ? joinWav(clips) : joinMp3(clips);
}
