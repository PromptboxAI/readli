# Readli copy word list

Words and phrases to scan for in anything a parent, grandparent or child reads: the site, the app, emails (including the Supabase auth emails), help articles, guides, social posts and the brand kit. Each row says what to look for, what to write instead and why.

Sources: the brand guide (`brand-kit/06-documents/readli-brand-guide.md`), the design brief, and Kevin's decisions in PRs #245, #261 and #262. "Found in" lists where the old wording still appeared on main on 2026-11-04, so those are the first places to fix.

Legal pages (`src/lib/content/terms.ts`, `src/lib/content/privacy-policy.ts`), admin pages, code comments and identifiers are out of scope. Legal text is allowed to say "synthetic", "AI" and "voice model" because it has to be precise.

## 1. Settled lines

Use these exactly. Don't paraphrase them.

| Line | Use |
|---|---|
| Your child's favorite stories, read by their favorite people. | Headline / tagline line. Starts with "Your child's", not "Their", so nobody wonders whose stories they are. One sentence with a comma, not two fragments. |
| Every Book. Every Voice. | Short tagline. |
| Your child's favorite stories, read by their favorite people. Readli reads classic children's books aloud in the voice of Mom, Dad, Grandma or anyone your child loves. | The one-line intro for someone who has never heard of Readli. In code it is `READLI_INTRO` in `src/lib/email/templates.ts`; use that constant in emails rather than retyping it. |
| Readli reads classic children's books aloud in the voices of the people your child loves. | Short description (SEO, footer, social bios). |

## 2. Find and replace

| Find | Replace with | Why | Found in (2026-11-04) |
|---|---|---|---|
| Their favorite stories. Read by their favorite people. | Your child's favorite stories, read by their favorite people. | "Their" at the start is ambiguous (Kevin, 2026-11-04). | `src/components/home/sections.tsx:32`, `src/app/opengraph-image.tsx:3` and `:18`, brand guide, design brief, PRD |
| the people your kids love / the voices your kids love | the people your child loves / the voices your child loves | Matches the settled line. "Your child" speaks to one parent about one child and reads warmer than "kids". | `src/lib/seo/site.ts:9`, `src/app/how-it-works/page.tsx:9`, `src/app/books/[slug]/page.tsx:51`, `src/app/signup/page.tsx:37`, `src/app/billing/narrator-slots/page.tsx:15`, `src/components/onboarding/Welcome.tsx:14`, `src/components/gifting/GiftOpen.tsx:103`, `src/lib/email/billing.ts:337`, `src/lib/email/feedback.ts:168`, brand guide, README |
| about five minutes (for recording a voice) | about one minute / about a minute | Reading the script takes about a minute (#262). Five minutes made recording sound like a chore. | Fixed in #262. Keep scanning new copy. |
| about a minute or two / about one to two minutes / about two minutes (for recording) | about a minute | One number everywhere, so people know what to expect. | `src/components/accounts/VoiceSetup.tsx:87`, `src/lib/guides/guides.ts:40` and `:42`, `src/lib/server/recording-qc.ts:39`, `src/app/grandparents/page.tsx:359` |
| voice cloning / cloned voice / clone (in product copy) | your Readli voice, family voices, record your voice | The brand guide avoids "AI clone" because it can feel creepy next to kids. The voice is the hero, the technology stays in the background. | `src/app/parents/safety/page.tsx:43` ("Voice cloning is optional") |
| AI narration / AI voice / AI-generated | read aloud in your voice | Readli is a storybook and a family keepsake, not an AI product. | Legal pages only (allowed there). |
| synthetic voice / synthesized | (rephrase: "read in Grandma's voice") | Same reason. | Legal pages only (allowed there). |
| voice model | your voice, your Readli voice | Technical term. | Legal pages only (allowed there). |
| Log in | Sign in | The auth emails already say "Sign in to Readli" and the account menu says "Sign out", so "Log in" is the odd one out. Pick one pair and use it everywhere. | `src/app/login/` page title and heading, "Log in to invite family to your circle", "Log in to set up your family…", "Log in to your own family…" (about 13 places) |
| sign-up / signup (as a word people read) | sign up (verb) | Plain words, and the hyphen and closed forms are mixed today. Leave URLs and code names alone. | A few labels, e.g. "Try it before you sign up" is already right. |
| favourite / colour / personalised | favorite / color / personalized | Readli writes US English. | `src/components/family/ChildProfiles.tsx:48`, `src/components/invites/JoinInvite.tsx:131`, error messages "read favourites" / "save favourite" in `src/lib/family/account-store.ts` |
| Try Your Voice Free (title case) | Try your voice free | Buttons and links are sentence case elsewhere. Brand CTA is "Hear a story in your voice, free". | `src/app/grandparents/page.tsx`, `src/components/home/sections.tsx` |
| the magic of storytelling | (cut, or say what actually happens) | Hype; brand tone is "gentle delight, not hype". | `src/app/donations/page.tsx:147` |
| forever / always available / guaranteed | (cut) | Never overpromise about voices (brand guide, design brief). | None in product copy today. |
| Click here | Name the action: "Open your invitation" | Plain, accessible link text. | None found today. |

## 3. Words to avoid

Don't use these in product or marketing copy at all:

- AI clone, voice clone, cloning, synthetic voice, deepfake, robot, voice model
- forever, eternal, guaranteed (about voices or access)
- invented testimonials, fake reviews or made-up numbers
- "users" (say families, parents, grandparents, storytellers)
- hype words: amazing, magical, revolutionary, seamless, game-changing

## 4. Writing rules to check by eye

These can't be found with a search, so read for them:

- **Short sentences.** No long run-on intro sentences. If an intro needs "and" twice, split it or cut it. The old invitation line "On Readli, you record your voice once, and the children your family's parents choose can hear you read classic books" is the example of what not to write (replaced in #261).
- **Say who "they" are.** Don't open a line with "their" or "they" before the reader knows who that is.
- **Name real people** (Mom, Dad, Grandma) when explaining what Readli does, so "voices" is clear.
- **Exclamation marks:** at most one per screen or email, for a real moment (a gift, "You're all set!"). Today there are many ("Welcome back!", "Your family is loving Readli!", "A Whole Year of Stories Awaits!"); trim the ones that aren't a moment.
- **No em dashes** in copy. Use a comma, a colon or a new sentence.

## 5. Needs Kevin's call

- **Narrator or storyteller?** The brand guide says "storytellers" and most of the app agrees, but the plan feature and several screens say "narrator" ("narrator slot", "Choose a narrator", "Waiting for a parent to add you as a narrator"). Suggestion: "storyteller" for the person everywhere, and decide whether "narrator slot" becomes "storyteller slot" (it's a billing term, so it also touches pricing and the Stripe product names).
- **"about a minute" or "about one minute"?** Both say the same thing and both are in use. The brand guide and most pages say "about a minute"; #262 wrote "about one minute". Either is fine; pick one if you want them identical.

## Allowed on purpose

- **"about five minutes" for the whole setup** on the welcome screen (`src/components/onboarding/Welcome.tsx:116`) is correct (#245). Only the recording itself is one minute.
- **"about one minute of reading"** on the pricing page describes what one credit buys, not recording time.
- **"family tree"** names the Tree view of the family circle, so it's fine there. Elsewhere say "family circle".
- **Sleep timer minutes** (15, 30, 45) and security wording ("expires in an hour") are not recording estimates.

## Quick scan

From the repo root, this lists the lines that still need a look (it skips tests, legal pages and admin):

```sh
grep -rniE "their favorite stories\. read|your kids love|five minutes|minute or two|one to two minutes|two minutes|clon(e|ed|ing)\b|\bAI\b|synthetic|voice model|\blog in\b|favourite|colour|personalised|magic of|forever|click here" src \
  --include=*.ts --include=*.tsx --exclude=*.test.ts --exclude=*.test.tsx \
  | grep -vE "src/lib/content/(terms|privacy-policy)\.ts|src/app/admin/|src/app/api/" \
  | grep -vE ":\s*(//|\*)"
```

Code names that match (like `clone_type` or `voice_cloned`) aren't shown to anyone and can be ignored.

## Adding to this list

When Kevin settles a wording question, add a row to section 2 (or a line to section 1) in the same PR that makes the change, with the date and PR number in "Why".
