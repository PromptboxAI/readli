/**
 * Stories & Guides: original articles for parents and grandparents (SEO brief, Phase 3). Kevin Godfrey
 * is the named author (Kevin, 2026-10-29). Paragraphs use the Help Center's link syntax, [text](/path),
 * so they render with HelpText. Facts here must match the product and the Help Center.
 */

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface Guide {
  slug: string;
  title: string;
  /** About 150 characters: the search snippet and the card text on /guides. */
  description: string;
  /** ISO dates. Bump `updated` whenever the text changes. */
  published: string;
  updated: string;
  readMinutes: number;
  intro: string;
  sections: GuideSection[];
  related: { href: string; label: string }[];
}

export const GUIDE_AUTHOR = { name: "Kevin Godfrey", title: "Founder of Readli", url: "/company#our-story" } as const;

export const GUIDES: readonly Guide[] = [
  {
    slug: "record-your-voice-for-bedtime-stories",
    title: "How to record your voice for your child's bedtime stories",
    description: "A parent's guide to recording a voice that sounds like you at bedtime: how long to read, how to sound natural, and how to set up a quiet room.",
    published: "2026-10-29",
    updated: "2026-10-29",
    readMinutes: 4,
    intro:
      "Your child knows your bedtime voice better than anyone's. A good recording captures that voice, the one you use with the lights low, so every story Readli reads sounds like you. Here's how to get it right the first time.",
    sections: [
      {
        heading: "Read for about one to two minutes",
        paragraphs: [
          "Readli needs about a minute of you reading aloud, ideally one to two. That is enough audio to learn how you sound. Reading for longer doesn't make the voice better, so there's no need to record a whole book.",
          "On the recording screen, a short story scrolls for you. Keep reading until the end of the script, and the Finish button turns on when you reach the last paragraph.",
        ],
      },
      {
        heading: "Use the voice you use at bedtime",
        paragraphs: [
          "Read the way you would at bedtime: warm, with gentle expression and natural pauses. That's the voice your child will hear.",
          "Stay in one voice all the way through. Skip accents, whispering, shouting and character voices, because your Readli voice copies all of it. A flat, careful reading voice gives a flat-sounding Readli voice too.",
        ],
      },
      {
        heading: "Pick a quiet, soft room",
        paragraphs: [
          "A bedroom is usually best, because soft things like curtains and bedding soak up echo. Bare kitchens and bathrooms echo more.",
          "Turn off the TV, music and fans, and make sure nobody else is talking. Hold your phone or microphone about a hand's width from your mouth, and keep it there the whole time.",
        ],
      },
      {
        heading: "Listen, then decide",
        paragraphs: [
          "A few moments after you finish, you hear a classic story read in your voice. If it doesn't sound like you, record again somewhere quieter, with a little more of your natural expression. The [recording tips](/help/recording-tips) cover a few more fixes.",
          "When you [try your voice](/try) without an account, the recording is private and deleted within 24 hours unless you choose to save it.",
        ],
      },
      {
        heading: "Invite the rest of the family",
        paragraphs: [
          "Once your voice is ready, you can invite grandparents, aunts, uncles and family friends to record theirs. Each person records and approves their own voice, and you choose which of your children can hear each one. See [how Readli works](/how-it-works) for the whole journey.",
        ],
      },
    ],
    related: [
      { href: "/help/recording-tips", label: "Tips for a better voice recording" },
      { href: "/family-voices", label: "Family Voices" },
      { href: "/help/voices-and-sharing/record-my-voice", label: "How do I record my voice?" },
    ],
  },
  {
    slug: "grandparents-bedtime-stories-from-far-away",
    title: "How grandparents can read bedtime stories from far away",
    description: "Live in a different town or time zone from your grandkids? Here's how to be part of their bedtime with stories read in your own voice.",
    published: "2026-10-29",
    updated: "2026-10-29",
    readMinutes: 4,
    intro:
      "Video calls are wonderful, but bedtime rarely lines up with a grandparent's evening, especially across time zones. Readli lets your grandchildren hear storybooks in your voice whenever bedtime comes, wherever you live.",
    sections: [
      {
        heading: "Record once, from your own phone or computer",
        paragraphs: [
          "You read a short story aloud for about a minute. The words scroll on the screen, so there's nothing to prepare and nothing to install. A few moments later, you hear a classic story read in your voice.",
          "You can [try it free](/try) before you make an account.",
        ],
      },
      {
        heading: "Share with each of your children's families",
        paragraphs: [
          "Save your voice with a free Readli Voice account and invite your grown-up children by email. Readli sends them a link from you, and they hear your voice straight away, with no account needed.",
          "You can share with more than one household, like each of your children's families, even if they live in different states. Every family keeps its own library and its own choices.",
        ],
      },
      {
        heading: "It's free for you",
        paragraphs: [
          "Sharing your voice is always free. The family that listens has the Readli Family plan, so you never pay to record or share, however many families you share with. See [does Grandpa need to pay?](/help/voices-and-sharing/grandpa-pay-to-share)",
        ],
      },
      {
        heading: "Parents stay in charge, and so do you",
        paragraphs: [
          "Your voice stays private when you record it. Only you can share it, and only with the families you choose. Your children then decide which grandkids can hear you, because every newly shared voice starts switched off for every child.",
          "You can stop sharing with any family whenever you like.",
        ],
      },
      {
        heading: "What your grandkids hear",
        paragraphs: [
          "Your grandchildren pick a book from the [Readli library](/books), from fairy tales and fables to chapter books like Winnie-the-Pooh and Heidi, and choose you as their storyteller. They can switch to another approved storyteller mid-story without losing their place.",
        ],
      },
    ],
    related: [
      { href: "/grandparents", label: "Readli for grandparents" },
      { href: "/help/getting-started/after-i-try-my-voice", label: "What happens after I try my voice?" },
      { href: "/help/voices-and-sharing/who-controls-my-voice", label: "Who controls my recorded voice?" },
    ],
  },
  {
    slug: "what-is-a-personalized-audiobook",
    title: "What is a personalized audiobook?",
    description: "Personalized audiobooks for kids can mean a child's name in the story or a story read in a loved one's voice. Here's the difference, and how Readli works.",
    published: "2026-10-29",
    updated: "2026-10-29",
    readMinutes: 3,
    intro:
      "\"Personalized audiobook\" can mean two different things. Some put a child's name into the story. Readli keeps the story and changes who reads it: a classic book read aloud in the voice of someone your child loves.",
    sections: [
      {
        heading: "Personalized words or a personal voice",
        paragraphs: [
          "Name-in-the-story books change the text so a child becomes a character. A voice-personalized audiobook keeps a well-loved story as it is and is read in a familiar voice, like a parent's, a grandparent's or an aunt's.",
          "For many children, the voice is what makes a story feel like bedtime. It's the same reason they ask for the same person to read the same book again.",
        ],
      },
      {
        heading: "How Readli makes one",
        paragraphs: [
          "A family member records about a minute of their natural storytime voice. A parent then picks a book from the [Readli library](/books) and that storyteller, and Readli prepares the narration in their voice.",
          "Preparing a new narration uses narration credits, which come with the Readli Family plan each month. Listening again, as many times as your children like, is always free. See [pricing](/pricing) for what's included.",
        ],
      },
      {
        heading: "Which books can be personalized",
        paragraphs: [
          "Readli reads classic children's books that are in the public domain: fairy tales, fables, nursery favorites, bedtime poems and longer chapter books. Stories run from under a minute to a few hours, and every book page shows how long it takes to read aloud.",
          "A family voice only reads books in the Readli library. Nobody can type in their own words for it to say.",
        ],
      },
      {
        heading: "More than one voice in the same story",
        paragraphs: [
          "If a book has been prepared in more than one approved voice, your child can switch storytellers mid-story, and the story carries on from the same sentence.",
        ],
      },
    ],
    related: [
      { href: "/how-it-works", label: "How Readli works" },
      { href: "/books", label: "The Readli Library" },
      { href: "/help/books-and-listening/whats-in-the-library", label: "What books are in the Readli library?" },
    ],
  },
  {
    slug: "keeping-family-voices-safe",
    title: "Keeping family voices safe: what parents should ask",
    description: "Before you share a family voice with any app, ask who owns it, who can hear it and what it can say. Here's a parent's checklist and how Readli answers it.",
    published: "2026-10-29",
    updated: "2026-10-29",
    readMinutes: 4,
    intro:
      "A recorded voice is personal. Before you or a grandparent shares one with any app, it's worth asking a few plain questions. Here's the checklist I'd want answered for my own family, with Readli's answers.",
    sections: [
      {
        heading: "Who owns the voice?",
        paragraphs: [
          "At Readli, the person who recorded the voice owns it. Only they can share it, they choose which families may use it, and they can stop sharing at any time. Nobody can share or use a voice on their behalf. See [who controls my voice?](/help/voices-and-sharing/who-controls-my-voice)",
        ],
      },
      {
        heading: "Can someone record a voice that isn't theirs?",
        paragraphs: [
          "People can only record their own voice. An invitation never lets anyone upload or copy someone else's voice.",
        ],
      },
      {
        heading: "Who can hear it?",
        paragraphs: [
          "Family voices are private and never made public. A child hears a storyteller only after two approvals: the storyteller shares with the family, and a parent switches that voice on for that particular child. Every newly shared voice starts switched off for every child.",
        ],
      },
      {
        heading: "What can the voice say?",
        paragraphs: [
          "A Readli voice only reads the storybooks in the Readli library. Nobody can type in their own words for it to say, so it can't be used to put words in a loved one's mouth.",
        ],
      },
      {
        heading: "Can I change my mind?",
        paragraphs: [
          "Yes. The storyteller and the parent can each withdraw their approval, and removing either one takes the voice off the child's list. You can also [ask us to delete](/help/privacy-and-child-safety/data-deletion) a voice and the data that goes with it.",
        ],
      },
      {
        heading: "Is the voice used for anything else?",
        paragraphs: [
          "Readli does not use family voice recordings or child-profile information for advertising. The [Privacy Policy](/privacy) sets out exactly what is collected and why, and [Family privacy & safety](/parents/safety) summarizes it in plain language.",
        ],
      },
    ],
    related: [
      { href: "/parents/safety", label: "Family privacy & safety" },
      { href: "/help/privacy-and-child-safety/are-family-voices-private", label: "Are family voices private?" },
      { href: "/help/privacy-and-child-safety/voice-used-without-permission", label: "Can someone use my voice without permission?" },
    ],
  },
];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

export function guideHref(g: Pick<Guide, "slug">): string {
  return `/guides/${g.slug}`;
}
