import { describe, expect, it } from "vitest";
import { toneWav } from "@/lib/voice/stub";
import { frameHeader, JoinError, joinClips } from "./join";

/** MPEG-1 Layer III, 128 kbps, 44.1 kHz, joint stereo: what ElevenLabs' mp3_44100_128 produces. */
function frame(opts: { padding?: boolean; rate?: 0 | 1; fill?: number } = {}) {
  const b1 = 0xfb;
  const b2 = (9 << 4) | ((opts.rate ?? 0) << 2) | (opts.padding ? 2 : 0);
  const h = frameHeader(new Uint8Array([0xff, b1, b2, 0x44]), 0)!;
  const f = new Uint8Array(h.length).fill(opts.fill ?? 0x55);
  f.set([0xff, b1, b2, 0x44]);
  return f;
}

function xingFrame() {
  const f = frame({ fill: 0 });
  f.set([..."Info"].map((c) => c.charCodeAt(0)), 4 + 32);
  return f;
}

function mp3(frames: number, extra: { id3?: boolean; xing?: boolean; tag?: boolean; rate?: 0 | 1 } = {}): ArrayBuffer {
  const parts: Uint8Array[] = [];
  if (extra.id3) parts.push(new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20]), new Uint8Array(20).fill(7));
  if (extra.xing) parts.push(xingFrame());
  for (let i = 0; i < frames; i++) parts.push(frame({ padding: i % 3 === 1, rate: extra.rate }));
  if (extra.tag) parts.push(new Uint8Array(128).fill(0x20).fill(0x54, 0, 1).fill(0x41, 1, 2).fill(0x47, 2, 3));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out.buffer;
}

const FRAME_MS = (1152 / 44100) * 1000;

describe("joining MP3 sentence clips", () => {
  it("joins frames back to back and times each clip by counting frames", () => {
    const t = joinClips([{ audio: mp3(10) }, { audio: mp3(25) }, { audio: mp3(4) }]);
    expect(t.contentType).toBe("audio/mpeg");
    [0, 10, 35].forEach((frames, i) => expect(t.clips[i]!.startMs).toBeCloseTo(frames * FRAME_MS, 6));
    [10, 25, 4].forEach((frames, i) => expect(t.clips[i]!.durationMs).toBeCloseTo(frames * FRAME_MS, 6));
    expect(t.durationMs).toBeCloseTo(39 * FRAME_MS, 6);
    // Every byte of the result is a whole frame.
    let at = 0;
    let n = 0;
    while (at < t.audio.length) {
      at += frameHeader(t.audio, at)!.length;
      n += 1;
    }
    expect(at).toBe(t.audio.length);
    expect(n).toBe(39);
  });

  it("leaves out ID3 tags and the encoder's Info frame, which aren't sound", () => {
    const plain = joinClips([{ audio: mp3(8) }, { audio: mp3(8) }]);
    const tagged = joinClips([{ audio: mp3(8, { id3: true, xing: true, tag: true }) }, { audio: mp3(8, { id3: true, xing: true, tag: true }) }]);
    expect(tagged.clips).toEqual(plain.clips);
    expect(tagged.audio).toEqual(plain.audio);
  });

  it("puts a pause of silent frames before a clip, such as the one before The End.", () => {
    const t = joinClips([{ audio: mp3(10) }, { audio: mp3(5), pauseBeforeMs: 600 }]);
    const silent = Math.round(600 / FRAME_MS);
    expect(t.clips[1]!.startMs).toBeCloseTo((10 + silent) * FRAME_MS, 6);
    expect(t.durationMs).toBeCloseTo((15 + silent) * FRAME_MS, 6);
    let first = 0;
    for (let i = 0; i < 10; i++) first += frameHeader(t.audio, first)!.length;
    const pause = t.audio.subarray(first, first + 417);
    expect(frameHeader(pause, 0)).toMatchObject({ length: 417, crc: false, sampleRate: 44100 });
    expect(pause.subarray(4).every((x) => x === 0)).toBe(true);
  });

  it("refuses clips recorded at different sample rates", () => {
    expect(() => joinClips([{ audio: mp3(3) }, { audio: mp3(3, { rate: 1 }) }])).toThrow(JoinError);
  });

  it("refuses a clip with no audio in it", () => {
    expect(() => joinClips([{ audio: mp3(3) }, { audio: new Uint8Array(500).buffer }])).toThrow(JoinError);
  });
});

describe("joining WAV clips (the stand-in tone)", () => {
  it("joins samples and times each clip exactly", () => {
    const t = joinClips([{ audio: toneWav(1) }, { audio: toneWav(1.5) }, { audio: toneWav(2), pauseBeforeMs: 600 }]);
    expect(t.contentType).toBe("audio/wav");
    expect(t.clips.map((c) => Math.round(c.startMs))).toEqual([0, 1000, 3100]);
    expect(t.clips.map((c) => Math.round(c.durationMs))).toEqual([1000, 1500, 2000]);
    expect(Math.round(t.durationMs)).toBe(5100);
    const v = new DataView(t.audio.buffer, t.audio.byteOffset);
    expect(v.getUint32(40, true)).toBe(t.audio.length - 44);
    expect(v.getUint32(24, true)).toBe(16_000);
  });

  it("refuses a mix of MP3 and WAV", () => {
    expect(() => joinClips([{ audio: toneWav(1) }, { audio: mp3(3) }])).toThrow(JoinError);
  });
});
