/**
 * Outdated-language scanner (Kevin, 2026-10-22). Old children's books use words whose meaning has
 * since turned sexual, racist or hurtful ("pussy" in The Owl and the Pussy-Cat, "Cinder-slut" in
 * Perrault). Every book is scanned before it joins the library: language-check.test.ts fails on any
 * finding a book's review in ./language-review.ts doesn't account for, and
 * `node scripts/language-scan.mjs` prints each flagged passage for a book being imported.
 *
 * Self-contained (no imports) so the script can load it with Node's type stripping.
 */

export type LanguageCategory = "sexual" | "racial" | "disability" | "profanity";

/** "change": should not reach children as written. "review": usually the old, harmless sense, but check. */
export type LanguageLevel = "change" | "review";

export interface LanguageTerm {
  /** Short id used in reviews, e.g. "pussy". */
  id: string;
  pattern: RegExp;
  category: LanguageCategory;
  level: LanguageLevel;
  /** Why it is flagged. */
  why: string;
  /** A child-appropriate replacement. */
  suggest: string;
}

const w = (body: string) => new RegExp(`\\b(?:${body})\\b`, "gi");

export const LANGUAGE_TERMS: readonly LanguageTerm[] = [
  { id: "pussy", pattern: w("puss(?:y|ies|ey)?"), category: "sexual", level: "change", why: "Now a sexual slang word.", suggest: "kitty" },
  { id: "cock", pattern: w("cocks?"), category: "sexual", level: "change", why: "Now a sexual slang word.", suggest: "rooster (Cock Robin: Robin Redbreast; turkey-cock: turkey)" },
  { id: "slut", pattern: w("sluts?"), category: "sexual", level: "change", why: "Once meant a kitchen drudge; now a sexual insult.", suggest: "Cinder-girl, or drop the nickname" },
  { id: "tits", pattern: w("tits?|tits-mouse|titmouse|titmice"), category: "sexual", level: "change", why: "Now a sexual slang word.", suggest: "a name without it (Tom Titmouse: Tom Thimble-mouse)" },
  { id: "dick", pattern: w("dick(?:y|ie|ies)?"), category: "sexual", level: "change", why: "Now a sexual slang word.", suggest: "shirt-fronts, or another name" },
  { id: "fag", pattern: w("fags?|faggots?|fagged"), category: "sexual", level: "change", why: "Now an anti-gay slur.", suggest: "bundle of sticks, or tired out" },
  { id: "ejaculate", pattern: w("ejaculat(?:e|ed|es|ing|ion|ions)"), category: "sexual", level: "change", why: "Once meant to exclaim; now sexual.", suggest: "exclaimed, cried out" },
  { id: "intercourse", pattern: w("intercourse"), category: "sexual", level: "change", why: "Once meant conversation; now sexual.", suggest: "talk, friendship" },
  { id: "erection", pattern: w("erections?"), category: "sexual", level: "change", why: "Now usually sexual.", suggest: "building" },
  { id: "make-love", pattern: w("(?:make|makes|made|making) love"), category: "sexual", level: "change", why: "Once meant to court; now sexual.", suggest: "courted, said sweet things to" },
  { id: "spunk", pattern: w("spunk(?:y)?"), category: "sexual", level: "change", why: "Once meant courage; now sexual slang.", suggest: "pluck, plucky" },
  { id: "knocked-up", pattern: w("knock(?:ed|s)? (?:\\w+ )?up"), category: "sexual", level: "review", why: "Once meant to wake someone; now means pregnant.", suggest: "woke up" },
  { id: "pecker", pattern: w("peckers?"), category: "sexual", level: "change", why: "Now sexual slang.", suggest: "chin, spirits" },
  { id: "boner", pattern: w("boners?"), category: "sexual", level: "change", why: "Now sexual slang.", suggest: "blunder" },
  { id: "bonk", pattern: w("bonk(?:s|ed|ing)?"), category: "sexual", level: "change", why: "Now sexual slang.", suggest: "bump" },
  { id: "dyke", pattern: w("dykes?"), category: "sexual", level: "change", why: "Now an anti-gay slur.", suggest: "dike, embankment" },
  { id: "fanny", pattern: w("fann(?:y|ies)"), category: "sexual", level: "review", why: "Sexual slang in British English (fine as a name).", suggest: "a different name" },
  { id: "gay", pattern: w("gay(?:er|est|ly|ety)?"), category: "sexual", level: "review", why: "Old sense is merry or bright; children now hear it as an identity word.", suggest: "merry, bright, cheerful" },
  { id: "queer", pattern: w("queer(?:er|est|ly|ness)?"), category: "sexual", level: "review", why: "Old sense is strange; children now hear it as an identity word or a slur.", suggest: "strange, odd, curious" },
  { id: "harlot", pattern: w("harlots?|whores?|hussy|hussies|wench(?:es)?|strumpets?"), category: "sexual", level: "change", why: "Sexual insult.", suggest: "girl, woman, or drop it" },

  { id: "n-word", pattern: w("nigg\\w*|nigra\\w*"), category: "racial", level: "change", why: "Racist slur.", suggest: "remove the passage or rewrite it" },
  { id: "negro", pattern: w("negro(?:e?s)?|negress(?:es)?"), category: "racial", level: "change", why: "Outdated racial term.", suggest: "remove or rewrite the passage" },
  { id: "darky", pattern: w("dark(?:e?y|ies)|darkies"), category: "racial", level: "change", why: "Racist slur.", suggest: "remove or rewrite the passage" },
  { id: "colored-person", pattern: w("colou?red (?:man|men|woman|women|people|person|persons|folks?|fell(?:ow|a)s?|boys?|girls?|gentlem[ae]n|lad(?:y|ies)|child(?:ren)?|cook|servants?|maids?)"), category: "racial", level: "change", why: "Outdated racial term.", suggest: "remove or rewrite the passage" },
  { id: "pickaninny", pattern: w("pickaninn(?:y|ies)|piccaninn(?:y|ies)"), category: "racial", level: "change", why: "Racist slur.", suggest: "remove or rewrite the passage" },
  { id: "mammy", pattern: w("mamm(?:y|ies)"), category: "racial", level: "review", why: "Racist stereotype when used of a Black nurse or cook.", suggest: "the character's name" },
  { id: "sambo", pattern: w("sambo|golliw[oa]gg?s?|gollyw[oa]gg?s?|coons?|jigaboos?|tar-bab(?:y|ies)"), category: "racial", level: "change", why: "Racist slur or caricature.", suggest: "remove or rewrite the passage" },
  { id: "asian-slur", pattern: w("japs?|chinam[ae]n|coolies?|gooks?"), category: "racial", level: "change", why: "Anti-Asian slur.", suggest: "the person's nationality, or rewrite" },
  { id: "chink", pattern: w("chinks?"), category: "racial", level: "review", why: "Anti-Asian slur (fine as a crack in a wall).", suggest: "crack, gap" },
  { id: "oriental", pattern: w("oriental"), category: "racial", level: "review", why: "Dated term for Asian people and places.", suggest: "Eastern, or drop it" },
  { id: "native-american", pattern: w("redskins?|red indians?|injuns?|squaws?|papooses?"), category: "racial", level: "change", why: "Slur or stereotype for Native Americans.", suggest: "remove or rewrite the passage" },
  { id: "indian", pattern: w("indians?"), category: "racial", level: "review", why: "Often a stereotype of Native Americans in old books (fine for India).", suggest: "check the sense; rewrite if it is a stereotype" },
  { id: "savage", pattern: w("savages?"), category: "racial", level: "review", why: "Old books use it for non-European peoples (fine as fierce).", suggest: "fierce, cross" },
  { id: "heathen", pattern: w("heathens?|barbarians?|cannibals?"), category: "racial", level: "review", why: "Old books use it for non-European peoples.", suggest: "rewrite the comparison" },
  { id: "hottentot", pattern: w("hottentots?|kaffirs?|bushm[ae]n|eskimos?|g[iy]ps(?:y|ies)|gyps?|half-?breeds?|half-?castes?|mulattos?|mulattoes|quadroons?|octoroons?|blackamoors?"), category: "racial", level: "change", why: "Racist or outdated name for a people.", suggest: "a respectful name, or rewrite" },
  { id: "jew-slur", pattern: w("jew(?:ed|ing)|yids?|kikes?|dagos?|wops?|spics?"), category: "racial", level: "change", why: "Ethnic slur.", suggest: "remove or rewrite the passage" },
  { id: "slave", pattern: w("slaves?|slavery"), category: "racial", level: "review", why: "Check the context.", suggest: "servants, helpers" },

  { id: "idiot", pattern: w("idiot(?:s|ic)?|imbeciles?|morons?|cretins?|retard(?:s|ed)?|spastics?|mongol(?:s|oid)?"), category: "disability", level: "review", why: "Once medical labels; now insults about disability.", suggest: "silly, foolish" },
  { id: "cripple", pattern: w("crippled?|cripples|midgets?"), category: "disability", level: "change", why: "Hurtful word for disabled people.", suggest: "who couldn't walk, small" },
  { id: "lame", pattern: w("lame"), category: "disability", level: "review", why: "Dated word for a disabled person (fine for an animal's leg).", suggest: "who couldn't walk, the name" },
  { id: "dumb", pattern: w("dumb"), category: "disability", level: "review", why: "Old sense is unable to speak; now an insult.", suggest: "speechless, silent" },
  { id: "lunatic", pattern: w("lunatics?|loonies?"), category: "disability", level: "review", why: "Dated word for mental illness.", suggest: "silly, wild" },

  { id: "profanity", pattern: w("damn(?:ed|s|ation)?|goddamn\\w*|bastards?|bitch(?:es)?|bugger(?:s|ed)?|bloody|arse|shit\\w*|fuck\\w*|piss(?:ed)?|crap"), category: "profanity", level: "review", why: "Swearing (bitch and bastard are fine only in their literal sense).", suggest: "drop it or soften it" },
];

export interface LanguageFinding {
  term: LanguageTerm;
  /** The words matched, as written. */
  match: string;
  chapter: number;
  chapterTitle: string;
  /** The sentence the match sits in. */
  passage: string;
}

function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const from = Math.max(before.search(/[^.!?\n]*$/), 0);
  const tail = text.slice(end).search(/[.!?\n]/);
  const to = tail < 0 ? text.length : end + tail + 1;
  return text.slice(from, to).replace(/\s+/g, " ").trim();
}

/** Every flagged word in a book's chapters, in reading order. Chapter titles are scanned too. */
export function scanChapters(chapters: readonly { title: string; text: string }[], terms: readonly LanguageTerm[] = LANGUAGE_TERMS): LanguageFinding[] {
  const findings: LanguageFinding[] = [];
  chapters.forEach((c, i) => {
    for (const source of [c.title, c.text]) {
      const hits: { at: number; finding: LanguageFinding }[] = [];
      for (const term of terms) {
        for (const m of source.matchAll(term.pattern)) {
          const passage = sentenceAround(source, m.index, m.index + m[0].length);
          hits.push({ at: m.index, finding: { term, match: m[0], chapter: i + 1, chapterTitle: c.title, passage } });
        }
      }
      findings.push(...hits.sort((a, b) => a.at - b.at).map((h) => h.finding));
    }
  });
  return findings;
}

/** How many times each term is found, for comparing a book against its review. */
export function countByTerm(findings: readonly LanguageFinding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.term.id] = (counts[f.term.id] ?? 0) + 1;
  return counts;
}
