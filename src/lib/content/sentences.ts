/** Splits a passage into sentences, keeping closing quotes with their sentence and titles like "Mrs." whole. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St)\.)(?<=[.!?][”"’]?)\s+(?=[“"A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}
