/**
 * Readli-authored teleprompter scripts (Amendment 001 §A).
 *
 * One continuous original script per recording mode. In Phase 2 these move to
 * the `voice_script_versions` table so copy can be edited and versioned
 * without a deploy; this file then becomes the seed.
 */

export type RecordingMode = "guest_short" | "family_short" | "premium_private";

export interface VoiceScriptVersion {
  id: string;
  mode: RecordingMode;
  locale: string;
  version: number;
  /** Paragraphs are visual breathing room only; the script reads as one take. */
  paragraphs: readonly string[];
}

/**
 * v3: ends on Kevin's goodnight rhyme (2026-10-11).
 * v2: one steady, warm read-aloud tone. ElevenLabs advises keeping energy
 * consistent across a clone sample, so the surprise passage is gentle wonder
 * rather than shouting.
 */
export const DEMO_SCRIPT: VoiceScriptVersion = {
  id: "guest_short.en.v3",
  mode: "guest_short",
  locale: "en",
  version: 3,
  paragraphs: [
    "Once upon a time, in a little house at the edge of a sleepy town, there lived a family who loved stories more than anything. Every night, just after the moon peeked over the rooftops, someone would pick up a book, settle into the big blue chair, and begin to read.",
    "Do you remember the first story you ever loved? Maybe it was about a brave rabbit, or a girl who tumbled down a hole, or a bear who couldn’t stop thinking about honey. I still remember mine. I must have asked for it a hundred times.",
    "And then, one evening, something wonderful happened. The book began to glow, soft and golden. Oh, look at that! The pages are turning all by themselves. Hold on tight, everybody. Here we go.",
    "On Tuesday the fourteenth, at half past seven, Grandma Rosa, Uncle Theo and little June counted the stars together: one, two, three, four, five, all the way to twenty-seven before June fell fast asleep.",
    "Some stories are short. Some take three whole weeks to finish. But the best ones always feel like home. So find a cozy spot, take a slow breath, and whenever you’re ready, turn the page. The next adventure is waiting just for you. Goodnight, sleep tight, don’t let the bed bugs bite, and leave on the hall light.",
  ],
};

export function wordCount(script: VoiceScriptVersion): number {
  return script.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
}

/** Splits a paragraph into sentences so the reader can highlight a reading region. */
export function splitSentences(paragraph: string): string[] {
  return paragraph.match(/[^.!?]+[.!?]+["’”]?\s*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [paragraph];
}
