import type { StoryLanguage } from "./the-end";

const ENGLISH = /(?<!\b(?:Mr|Mrs|Ms|Dr|St)\.)(?<=[.!?][”"’]?)\s+(?=[“"A-Z])/;
/**
 * Spanish sentences can open with ¿ or ¡, an accented capital, a dialogue dash (—) or «, and can close
 * with … or ». Spanish texts are edited to spell out abbreviations like "Sr." and "D.", so none are kept.
 */
const SPANISH = /(?<=[.!?…][”"’»]?)\s+(?=[¿¡“"«—A-ZÁÉÍÓÚÑÜ])/;

/** Splits a passage into sentences, keeping closing quotes with their sentence and titles like "Mrs." whole. */
export function sentencesOf(text: string, language: StoryLanguage = "en"): string[] {
  return text
    .split(language === "es" ? SPANISH : ENGLISH)
    .map((s) => s.trim())
    .filter(Boolean);
}
