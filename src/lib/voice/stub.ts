import type { SynthesizedAudio, VoiceProvider } from "./provider";

/**
 * Stand-in provider for local dev and automated tests (VOICE_PROVIDER=stub). It never clones
 * anything: synthesis returns a short soft tone, and the UI labels it as not the guest's voice.
 */
export class StubVoiceProvider implements VoiceProvider {
  readonly deleted: string[] = [];
  private next = 1;

  async createInstantVoice() {
    return { voiceId: `stub-voice-${this.next++}` };
  }

  async synthesize({ text }: { voiceId: string; text: string }): Promise<SynthesizedAudio> {
    // About a fifth of a second per word, capped so tests stay fast.
    const seconds = Math.min(4, Math.max(1, text.split(/\s+/).length / 25));
    return { audio: toneWav(seconds), contentType: "audio/wav", standIn: true };
  }

  async deleteVoice(voiceId: string) {
    this.deleted.push(voiceId);
  }
}

/** The stand-in tone, also used to seed the preview family's prepared narrations. */
export function toneWav(seconds: number): ArrayBuffer {
  const rate = 16_000;
  const samples = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 800, (samples - i) / 800);
    v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 392 * i) / rate) * 3000 * fade), true);
  }
  return buf;
}
