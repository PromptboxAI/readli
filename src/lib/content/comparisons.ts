/**
 * Readli comparison pages (/vs/...). Keep every line about another product factual, sourced from its own
 * public pages or app store listings, and dated: products and prices change, so other products' prices
 * are linked rather than quoted. No disparaging claims; each page says who the other product suits.
 * Kevin, 2026-11-13: start with Lullify, StoryBee and Yoto, with an FAQ on pricing, real family voices
 * versus AI stories, and two-sided parent approval.
 */

export const COMPARISONS_CHECKED = "November 2026";

/** The live numbers a comparison quotes about Readli, so the copy never drifts from /pricing or the library. */
export interface ReadliFacts {
  readyBooks: number;
  monthly: string;
  annual: string;
  maxChildProfiles: number;
  giftHouseholds: number;
}

export interface ComparisonRow {
  topic: string;
  readli: string;
  them: string;
}

export interface ComparisonFaq {
  q: string;
  a: string;
}

export interface Comparison {
  slug: string;
  name: string;
  /** The other product's own site, shown and linked in the sources. */
  site: string;
  /** One neutral sentence on what the other product is. */
  whatTheyAre: string;
  metaDescription: string;
  intro: string;
  rows: ComparisonRow[];
  /** When the other product may be the better fit, in plain terms. */
  theyFit: string[];
  faqs: ComparisonFaq[];
  sources: { label: string; href: string }[];
}

/** What sets Readli apart, shown first on every comparison page. */
export function readliStrengths(f: ReadliFacts): { title: string; body: string }[] {
  return [
    {
      title: "Real voices on real classics",
      body: `Readli reads published children's classics, in the author's own words, in the voice of someone your child loves. ${f.readyBooks} books are ready today, from Aesop and Grimm to Peter Rabbit and Winnie-the-Pooh.`,
    },
    {
      title: "Two approvals before a child hears a voice",
      body: "The storyteller chooses which families can use their voice, then a parent approves it for each child. A newly shared voice starts switched off for every child.",
    },
    {
      title: "Storytellers never pay",
      body: "Recording and sharing a voice is free with Readli Voice. Grandparents record about a minute from their own phone or computer, and the family that listens has the plan.",
    },
    {
      title: "One voice, every grandchild",
      body: `One storyteller can share with every family they choose. You can also give Readli Family to up to ${f.giftHouseholds} families, and the yearly gift is paid once and never renews on its own.`,
    },
  ];
}

function readliPriceAnswer(f: ReadliFacts): string {
  return `Readli Family is ${f.monthly} a month or ${f.annual} a year for the whole household, and you can cancel any time. Anyone who records their voice uses Readli free.`;
}

const APPROVAL_FAQ: ComparisonFaq = {
  q: "Who decides which voices my child hears on Readli?",
  a: "Two people do. The storyteller chooses which families may use their voice, and then a parent or guardian approves that voice for each child. A newly shared voice starts switched off for every child, and either person can withdraw their approval at any time.",
};

export function comparisons(f: ReadliFacts): Comparison[] {
  return [
    {
      slug: "lullify",
      name: "Lullify",
      site: "lullify.io",
      whatTheyAre: "Lullify is a phone app that reads bedtime stories in a parent's voice, made from a few short voice samples.",
      metaDescription:
        "Readli or Lullify? Both read bedtime stories in a parent's voice. Here's how they differ on books, family sharing, parent approval, gifting and price.",
      intro:
        "Readli and Lullify share a lovely idea: bedtime stories in the voice your child knows best. They're built for different families. Lullify centres on a parent's voice in a phone app. Readli is built for the whole family, so grandparents and other loved ones can record from wherever they live and read real classic books.",
      rows: [
        {
          topic: "Stories",
          readli: `${f.readyBooks} classic children's books in the original words: fairy tales, fables, poems and chapter books.`,
          them: "A library of bedtime stories for young children.",
        },
        {
          topic: "Who records",
          readli: "Anyone in the family, from their own phone or computer, after a private invitation.",
          them: "Voices are recorded in the Lullify app.",
        },
        {
          topic: "Cost to the storyteller",
          readli: "Free. Readli Voice costs nothing to record or share.",
          them: "Custom voices come with Lullify's paid Premium and Family plans.",
        },
        {
          topic: "Who can hear a voice",
          readli: "A child hears a voice only after the storyteller shares it and a parent approves it for that child.",
          them: "Lullify says your voice isn't accessible to anyone outside your account.",
        },
        {
          topic: "Children",
          readli: `Up to ${f.maxChildProfiles} child profiles, each with its own list of approved storytellers.`,
          them: "We didn't see child profiles described on Lullify's site.",
        },
        {
          topic: "Gifting",
          readli: `Give Readli Family to up to ${f.giftHouseholds} families. The yearly gift is paid once and never renews.`,
          them: "We didn't find a gift option on Lullify's site.",
        },
        {
          topic: "Where it works",
          readli: "In the web browser on phones, tablets and computers.",
          them: "Native iPhone and Android apps.",
        },
        {
          topic: "How you pay",
          readli: "On the web, monthly or yearly. Cancel any time.",
          them: "Through the App Store or Google Play, across three plans.",
        },
        {
          topic: "Try it first",
          readli: "Hear a story in your own voice free, with no account.",
          them: "Free trials on some of its plans.",
        },
      ],
      theyFit: [
        "You'd rather have a native iPhone or Android app.",
        "You mainly want one parent's voice on short bedtime stories.",
        "You'd like a low-cost plan with a stock narrator voice.",
      ],
      faqs: [
        {
          q: "How does Readli's price compare with Lullify's?",
          a: `${readliPriceAnswer(f)} Lullify sells three plans through the App Store and Google Play, and custom voices start on its Premium plan. Lullify's current prices are on lullify.io/pricing.`,
        },
        {
          q: "Are Readli's stories written by AI?",
          a: "No. Readli reads published classic children's books, word for word. AI is used only to make the storyteller's voice, from a short recording they choose to make, so the words are the author's and the voice is someone your child loves.",
        },
        {
          q: "Can grandparents use Readli if they live far away?",
          a: "Yes. Send them a private invitation and they record about a minute on their own phone or computer, for free. Once you approve their voice for your children, every book in the library can play in it.",
        },
        APPROVAL_FAQ,
      ],
      sources: [
        { label: "Lullify home page", href: "https://www.lullify.io/" },
        { label: "Lullify pricing", href: "https://www.lullify.io/pricing" },
        { label: "Lullify privacy policy", href: "https://www.lullify.io/privacy-policy" },
        { label: "Lullify on the App Store", href: "https://apps.apple.com/us/app/lullify/id6742806527" },
        { label: "Lullify on Google Play", href: "https://play.google.com/store/apps/details?id=io.lullify.app" },
      ],
    },
    {
      slug: "storybee",
      name: "StoryBee",
      site: "storybee.app",
      whatTheyAre: "StoryBee is an AI story maker that writes, illustrates and narrates new stories from your ideas.",
      metaDescription:
        "Readli or StoryBee? StoryBee makes new AI stories. Readli reads classic children's books in a loved one's real voice. Here's how they compare.",
      intro:
        "StoryBee and Readli solve different bedtime problems. StoryBee makes brand-new stories, written and illustrated by AI, with your child in them. Readli reads the classic books families have loved for generations, in the voice of a parent, grandparent or other loved one.",
      rows: [
        {
          topic: "Stories",
          readli: `${f.readyBooks} published classic books, read word for word.`,
          them: "New stories written by AI from your prompts, for a range of ages.",
        },
        {
          topic: "The voice",
          readli: "A family voice is the heart of Readli. Every book can play in each approved storyteller's voice.",
          them: "Stock narrator voices, with voice cloning on higher plans.",
        },
        {
          topic: "Cost to the storyteller",
          readli: "Free. Readli Voice costs nothing to record or share.",
          them: "Voice cloning starts on StoryBee's Bee Hive plan.",
        },
        {
          topic: "Who can hear a voice",
          readli: "A child hears a voice only after the storyteller shares it and a parent approves it for that child.",
          them: "StoryBee says you own your voice clone.",
        },
        {
          topic: "Pictures",
          readli: "Original cover art for every book, with read-along text.",
          them: "AI illustrations in several art styles.",
        },
        {
          topic: "Languages",
          readli: "English.",
          them: "Several languages.",
        },
        {
          topic: "Gifting",
          readli: `Give Readli Family to up to ${f.giftHouseholds} families. The yearly gift is paid once and never renews.`,
          them: "We didn't find a gift subscription on StoryBee's site.",
        },
        {
          topic: "How you pay",
          readli: "One family plan, monthly or yearly. Cancel any time.",
          them: "Four plans with monthly story allowances.",
        },
      ],
      theyFit: [
        "You want brand-new stories with your child as the hero.",
        "You'd like illustrations in different art styles.",
        "You want stories in a language other than English.",
        "You'd like printed books of the stories you make.",
      ],
      faqs: [
        {
          q: "How does Readli's price compare with StoryBee's?",
          a: `${readliPriceAnswer(f)} StoryBee has four plans with monthly story allowances, and voice cloning starts on its Bee Hive plan. StoryBee's current prices are on storybee.app/pricing.`,
        },
        {
          q: "What's the difference between a real family voice and an AI story?",
          a: "StoryBee uses AI to write new stories. Readli doesn't write anything: it reads published classics, word for word, so there's nothing new to check before bedtime. AI is used only to make the storyteller's voice, from a short recording they choose to make.",
        },
        {
          q: "Can I hear Readli before I sign up?",
          a: "Yes. Record about a minute on readli.ai/try and hear a classic story in your own voice, free and with no account.",
        },
        APPROVAL_FAQ,
      ],
      sources: [
        { label: "StoryBee home page", href: "https://storybee.app/" },
        { label: "StoryBee pricing", href: "https://storybee.app/pricing" },
        { label: "StoryBee voice cloning", href: "https://storybee.app/clone-voice" },
        { label: "StoryBee on the App Store", href: "https://apps.apple.com/us/app/storybee-ai-story-creator/id6754698469" },
      ],
    },
    {
      slug: "yoto",
      name: "Yoto",
      site: "yotoplay.com",
      whatTheyAre: "Yoto is a screen-free audio player for children that plays stories, music and more from cards.",
      metaDescription:
        "Readli or Yoto? Yoto is a screen-free player for audio cards. Readli reads classic books in a loved one's voice from about a minute of recording. Here's how they compare.",
      intro:
        "Yoto and Readli both bring stories to bedtime, in very different ways. Yoto is a screen-free speaker that plays audio cards, including cards you record yourself. Readli turns about a minute of a loved one's voice into a whole shelf of classic books read in that voice.",
      rows: [
        {
          topic: "A family voice",
          readli: "Record about a minute and every book in the library can play in your voice.",
          them: "Make Your Own cards play recordings you make in the Yoto app, so a storyteller reads each story aloud in full.",
        },
        {
          topic: "Stories",
          readli: `${f.readyBooks} classic children's books, ready in each approved family voice.`,
          them: "A large range of audio cards, from audiobooks to music and podcasts.",
        },
        {
          topic: "What you need",
          readli: "The phone, tablet or computer you already have.",
          them: "A Yoto Player or Yoto Mini, plus the cards you choose.",
        },
        {
          topic: "Screens",
          readli: "Plays on a device with a screen, inside a parent-managed kids profile.",
          them: "Screen-free.",
        },
        {
          topic: "How the voice is made",
          readli: "An AI voice made from the storyteller's own recording, with their consent.",
          them: "Your actual recording, played back as you made it.",
        },
        {
          topic: "Sharing across homes",
          readli: "One storyteller can share with every family they choose, and a parent approves each voice for each child.",
          them: "Family members added to a Yoto family account can record into the app.",
        },
        {
          topic: "How you pay",
          readli: "One family plan, monthly or yearly. Cancel any time.",
          them: "You buy the player and the cards you want.",
        },
      ],
      theyFit: [
        "You want a screen-free device in your child's room.",
        "You'd like the exact recording of someone reading, with no AI involved.",
        "You want music, podcasts and audiobooks on the same player.",
      ],
      faqs: [
        {
          q: "How does Readli's price compare with Yoto?",
          a: `${readliPriceAnswer(f)} Yoto is a player you buy, plus the cards you choose; its current prices are on yotoplay.com.`,
        },
        {
          q: "Isn't a real recording better than an AI voice?",
          a: "A real recording is wonderful, and Yoto's Make Your Own cards are a lovely way to keep one. The difference is effort: a grandparent would need to read every book aloud, start to finish. With Readli they record about a minute, and the whole library can play in their voice, in the author's original words.",
        },
        {
          q: "Can grandparents record for Readli from their own home?",
          a: "Yes. Send them a private invitation and they record on their own phone or computer, for free. Their voice reaches your children only after you approve it.",
        },
        APPROVAL_FAQ,
      ],
      sources: [
        { label: "Yoto Make Your Own", href: "https://yotoplay.com/myo" },
        { label: "Yoto help: Make Your Own cards", href: "https://support.yotoplay.com/en-US/introduction-to-make-your-own-11556" },
      ],
    },
  ];
}

/** Shorter notes on other ways families do bedtime stories, shown on /vs. No page of their own yet. */
export const OTHER_OPTIONS: { name: string; body: string; href?: string }[] = [
  {
    name: "Sleepytale",
    body: "A phone app that creates personalized AI stories and lullabies. A good fit if you want new stories made for your child; Readli reads classic books in a family member's voice instead.",
    href: "https://apps.apple.com/us/app/sleepytale-stories-songs/id6714453800",
  },
  {
    name: "Audiobook subscriptions",
    body: "Services such as Audible offer huge catalogs read by professional narrators. Readli is for the nights your child wants a voice they know.",
  },
  {
    name: "Reading live, or sending a voice memo",
    body: "Nothing beats reading together, and Readli isn't meant to replace it. It's for the nights you can't be there: one short recording, and every book in the library is ready in your voice.",
  },
];

export function comparisonHref(slug: string): string {
  return `/vs/${slug}`;
}

export const COMPARISON_SLUGS = ["lullify", "storybee", "yoto"] as const;

export const COMPARISON_NAMES: Record<(typeof COMPARISON_SLUGS)[number], string> = { lullify: "Lullify", storybee: "StoryBee", yoto: "Yoto" };
