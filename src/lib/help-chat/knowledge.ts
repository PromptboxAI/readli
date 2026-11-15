import { ACCESSIBILITY_INTRO, ACCESSIBILITY_SECTIONS } from "@/lib/content/accessibility";
import { COMPANY, COMPANY_ADDRESS } from "@/lib/content/company";
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_INTRO, PRIVACY_SECTIONS, type PolicySection } from "@/lib/content/privacy-policy";
import type { Pricing } from "@/lib/content/pricing";
import { TERMS_EFFECTIVE_DATE, TERMS_INTRO, TERMS_SECTIONS } from "@/lib/content/terms";
import { GUIDES } from "@/lib/guides/guides";
import { HELP_CATEGORIES, SUPPORT_EMAIL } from "@/lib/help/articles";
import { HANDOUTS } from "@/lib/help/handouts";
import { articleHref, visibleArticles } from "@/lib/help/search";
import type { PublicBook } from "@/lib/library/public";

/**
 * Everything the help chatbot knows, built from the same content the site renders (Kevin, 2026-11-15:
 * "all of our combined knowledge"). It reads the Help Center, printable guides, Stories & Guides, the
 * legal pages and the library, so editing any of those updates the bot on the next deploy. Only
 * published help articles go in: drafts describe features that aren't live.
 */

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function policy(title: string, effective: string | null, intro: string[], sections: PolicySection[], href: string): string {
  const lines = [`## ${title} (${href})${effective ? `, effective ${effective}` : ""}`, ...intro];
  for (const s of sections) {
    lines.push(`### ${s.title}`);
    for (const p of s.paragraphs) lines.push(p.lead ? `${p.lead}: ${p.text}` : p.text);
  }
  return lines.join("\n");
}

function helpCenter(): string {
  const articles = visibleArticles(false);
  const out = ["# Help Center articles (/help)"];
  for (const c of HELP_CATEGORIES) {
    const inCategory = articles.filter((a) => a.category === c.slug);
    if (inCategory.length === 0) continue;
    out.push(`## ${c.title}`);
    for (const a of inCategory) out.push(`### ${a.question}\nLink: ${articleHref(a)}\n${a.answer.join("\n")}`);
  }
  return out.join("\n\n");
}

function handouts(): string {
  const out = ["# Printable guides (/help/print)"];
  for (const h of HANDOUTS) {
    out.push(
      [`## ${h.title}`, `Link: /help/print/${h.slug}`, h.intro, ...h.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`), h.footer].join("\n"),
    );
  }
  return out.join("\n\n");
}

function guides(): string {
  const out = ["# Stories & Guides for parents and grandparents (/guides)"];
  for (const g of GUIDES) {
    const body = g.sections.map((s) => `### ${s.heading}\n${s.paragraphs.join("\n")}`).join("\n");
    out.push(`## ${g.title}\nLink: /guides/${g.slug}\n${g.intro}\n${body}`);
  }
  return out.join("\n\n");
}

function library(books: readonly PublicBook[]): string {
  const ready = books.filter((b) => !b.comingSoon);
  const soon = books.filter((b) => b.comingSoon);
  const line = (b: PublicBook) => `- ${b.title} by ${b.author}, about ${b.minutes} min (/books/${b.slug})`;
  return [
    "# The Readli library (/books)",
    "## Ready to read now",
    ...ready.map(line),
    ...(soon.length ? ["## Coming soon", ...soon.map((b) => `- ${b.title} by ${b.author}`)] : []),
  ].join("\n");
}

function company(): string {
  return [
    "# Company and contact",
    `Readli is run by ${COMPANY.legalName}, ${COMPANY_ADDRESS}.`,
    `Support email: ${SUPPORT_EMAIL}. Company page: /company. Pricing: /pricing. Try a voice without signing up: /try.`,
  ].join("\n");
}

/** Everything that changes only on deploy. Cached by the API, so keep it byte-for-byte stable. */
export function staticKnowledge(books: readonly PublicBook[]): string {
  return [
    company(),
    helpCenter(),
    handouts(),
    guides(),
    library(books),
    "# Legal pages",
    policy("Privacy Policy", PRIVACY_EFFECTIVE_DATE, PRIVACY_INTRO, PRIVACY_SECTIONS, "/privacy"),
    policy("Terms of Service", TERMS_EFFECTIVE_DATE, TERMS_INTRO, TERMS_SECTIONS, "/terms"),
    policy("Accessibility Statement", null, ACCESSIBILITY_INTRO, ACCESSIBILITY_SECTIONS, "/accessibility"),
  ].join("\n\n");
}

/** Today's plan and prices, as an admin may have changed them on /admin/plans. These win over older numbers above. */
export function pricingKnowledge(p: Pricing): string {
  const lines = [
    "# Current plan and prices (these are the live numbers; if anything above disagrees, use these)",
    `Readli Family: ${dollars(p.familyMonthlyCents)} a month or ${dollars(p.familyAnnualCents)} a year.`,
    `Includes ${p.includedNarratorSlots} storyteller slots (extra slots ${dollars(p.extraSlotMonthlyCents)} a month each), up to ${p.maxChildProfiles} child profiles, ${p.simultaneousListeners} children listening at the same time, and ${p.monthlyCredits} narration credits a month.`,
    `One credit covers about ${p.charactersPerCredit} characters of narration, roughly one minute of new reading in one voice.`,
  ];
  lines.push("Readli Voice, for grown-ups who only share their voice, is free.");
  return lines.join("\n");
}
