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
    updated: "2026-11-14",
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
          "Family voices are made by ElevenLabs, Readli's voice provider, and they are never used to train AI or sold to anyone. Readli does not use family voice recordings or child-profile information for advertising. The [Privacy Policy](/privacy) sets out exactly what is collected and why, and [Family privacy & safety](/parents/safety) summarizes it in plain language.",
        ],
      },
    ],
    related: [
      { href: "/parents/safety", label: "Family privacy & safety" },
      { href: "/help/privacy-and-child-safety/are-family-voices-private", label: "Are family voices private?" },
      { href: "/help/privacy-and-child-safety/voice-used-without-permission", label: "Can someone use my voice without permission?" },
    ],
  },
  {
    slug: "bedtime-stories-in-grandmas-voice",
    title: "How to get bedtime stories read in Grandma's voice",
    description: "A parent's step-by-step guide to having Grandma or Grandpa read your kids' bedtime stories in their own voice, even when they live far away.",
    published: "2026-11-14",
    updated: "2026-11-14",
    readMinutes: 4,
    intro:
      "Most kids have one voice they ask for at bedtime that isn't Mom's or Dad's. Often it's Grandma's. Here's how to set things up so your children can hear their grandparents read a storybook any night of the week, without anyone needing to be on a video call.",
    sections: [
      {
        heading: "Invite Grandma from Readli Family",
        paragraphs: [
          "From Family Home, send Grandma an invitation by email. She gets a link from you and records from her own phone, tablet or computer, wherever she lives. There's nothing to install. See [can I invite grandparents who live elsewhere?](/help/getting-started/invite-relatives-elsewhere)",
        ],
      },
      {
        heading: "She reads for about a minute",
        paragraphs: [
          "A short story scrolls on her screen, and she reads it aloud the way she would at bedtime. About a minute is enough. A few moments later she hears a classic story read in her own voice, so she knows how it sounds before anything is shared.",
          "If she'd like a few pointers first, send her [how to record your voice for bedtime stories](/guides/record-your-voice-for-bedtime-stories). A quiet bedroom and her normal reading voice make the biggest difference.",
        ],
      },
      {
        heading: "It's free for her",
        paragraphs: [
          "Grandparents never pay to record or share their voice, however many of their children's families they share with. The family that listens has the Readli Family plan. See [does Grandpa need to pay?](/help/voices-and-sharing/grandpa-pay-to-share)",
        ],
      },
      {
        heading: "Two approvals, then she's on the bookshelf",
        paragraphs: [
          "Grandma's voice belongs to her, so she chooses to share it with your family. Then you switch it on for each child who should hear it. Every newly shared voice starts switched off, so nothing reaches your kids until you say so.",
        ],
      },
      {
        heading: "Pick a book and press play",
        paragraphs: [
          "Choose a book from the [Readli library](/books), from The Velveteen Rabbit and Peter Rabbit to chapter books like Winnie-the-Pooh, and prepare it in Grandma's voice. It appears on the bookshelf of every child you approved, with the words highlighted as she reads.",
          "At bedtime, the [sleep timer](/help/books-and-listening/sleep-timer-and-speed) can stop the story after 15, 30 or 45 minutes, or at the end of a chapter. Going somewhere without signal? [Download the story](/help/books-and-listening/listen-offline) first and it plays offline.",
        ],
      },
      {
        heading: "What Grandma's voice can't do",
        paragraphs: [
          "A Readli voice only reads the storybooks in the Readli library. Nobody can type their own words for it to say, it's never made public, and it's never used to train AI. [Family privacy & safety](/parents/safety) explains exactly how it's made, kept and deleted.",
        ],
      },
    ],
    related: [
      { href: "/grandparents", label: "Readli for grandparents" },
      { href: "/guides/grandparents-bedtime-stories-from-far-away", label: "How grandparents can read bedtime stories from far away" },
      { href: "/help/voices-and-sharing/who-controls-my-voice", label: "Who controls my recorded voice?" },
    ],
  },
  {
    slug: "gift-for-long-distance-grandparents",
    title: "A gift for long-distance grandparents: stories in their voice",
    description: "Looking for a meaningful gift when grandparents and grandkids live far apart? Give bedtime stories read in a grandparent's own voice.",
    published: "2026-11-14",
    updated: "2026-11-14",
    readMinutes: 4,
    intro:
      "When grandparents live a plane ride away, the hardest thing to give is time together. A bedtime story in Grandpa's voice, playing in his grandkids' room every night, comes close. Here's how to give it, whether you're the grandparent or the parent.",
    sections: [
      {
        heading: "Why it lands",
        paragraphs: [
          "Most gifts for grandparents are things. This one is a habit: the grandkids hear Grandma or Grandpa read a storybook at bedtime, again and again, long after the wrapping paper is gone. And because the books are classics like Peter Rabbit and Winnie-the-Pooh, they're often the same stories the grandparents read to their own children.",
        ],
      },
      {
        heading: "If you're the grandparent",
        paragraphs: [
          "Start by recording your voice. You read a short story aloud for about a minute, and you can [try it free](/try) before you make an account. Recording and sharing your voice is always free.",
          "Then give the stories too. A [Readli gift](/pricing#gift-heading) covers Readli Family for up to two of your children's families, either a whole year paid once (it never renews on its own) or month to month. The families never enter a card. When you give it, tick Share my voice and your voice goes along with the gift.",
          "You can schedule the gift for Christmas or another date, and add your own message.",
        ],
      },
      {
        heading: "If you're the parent",
        paragraphs: [
          "The gift for Grandma is the invitation. From Readli Family, invite her to record, and she reads for about a minute from her own phone or computer. It costs her nothing. Then send her a photo or a video of the kids listening to her read. See [how to get bedtime stories read in Grandma's voice](/guides/bedtime-stories-in-grandmas-voice).",
        ],
      },
      {
        heading: "Make the unwrapping special",
        paragraphs: [
          "Readli emails the gift with your name and message, and the family opens it from the link in that email. Some grandparents like to pair it with a printed copy of the first book they'll be reading, so the kids can turn the pages while they listen.",
        ],
      },
      {
        heading: "Parents stay in charge",
        paragraphs: [
          "Giving Readli never gives the giver access to the family's account, children or other voices. The parents add their children and decide which storytellers each child can hear, grandparents included. See [how gift memberships work](/help/billing-credits-and-gifts/gift-memberships).",
        ],
      },
    ],
    related: [
      { href: "/pricing#gift-heading", label: "Give Readli as a gift" },
      { href: "/grandparents", label: "Readli for grandparents" },
      { href: "/help/billing-credits-and-gifts/redeem-a-gift", label: "How do I redeem a gift?" },
    ],
  },
  {
    slug: "choosing-a-voice-cloning-bedtime-story-app",
    title: "Choosing a bedtime story app that reads in your voice",
    description: "Voice cloning bedtime story apps compared on what matters: who owns the voice, what it can say, the stories it reads and what you really pay.",
    published: "2026-11-14",
    updated: "2026-11-14",
    readMinutes: 5,
    intro:
      "There are now lots of apps that can read your child a story in a parent's or grandparent's voice. They differ a lot once you look past the demo. Here are the questions I'd ask before giving any of them a family voice, and how Readli answers each one.",
    sections: [
      {
        heading: "What will it read: made-up stories or real books?",
        paragraphs: [
          "Many voice apps are AI story generators: you type an idea and the app writes a new story. That's fun, but every story is new to you too, so most reviewers suggest reading each one before your child hears it.",
          "Readli reads real books instead: classic children's stories like The Velveteen Rabbit, The Tale of Peter Rabbit and Winnie-the-Pooh, word for word from a reviewed edition. You know exactly what your child will hear. Browse the [Readli library](/books).",
        ],
      },
      {
        heading: "Who owns the voice, and who can use it?",
        paragraphs: [
          "Ask whether the person who recorded the voice controls it, or whoever pays for the account. At Readli the storyteller owns their voice: only they can share it, they choose which families may use it, and a parent then approves it for each child. See [keeping family voices safe](/guides/keeping-family-voices-safe).",
        ],
      },
      {
        heading: "Can the voice be made to say anything?",
        paragraphs: [
          "If an app lets you type any text for a cloned voice to speak, it can put words in a loved one's mouth. A Readli voice only reads the storybooks in the Readli library. Nobody can type in their own words for it.",
        ],
      },
      {
        heading: "Where does the voice go, and is it used to train AI?",
        paragraphs: [
          "A good app names its voice provider, says whether recordings train AI, and tells you how deletion works. Readli's voices are made by ElevenLabs, they're never used to train AI, and deleting your account deletes your voice, recordings and every story read in your voice. [Family privacy & safety](/parents/safety) has the details.",
        ],
      },
      {
        heading: "Is the whole family included?",
        paragraphs: [
          "Bedtime is better with more than one storyteller. Check whether grandparents, aunts and uncles have to pay to record, and whether one plan covers every child. With Readli, recording and sharing a voice is always free for every storyteller, including grandparents in other households, and one Readli Family plan gives each of your children their own profile.",
        ],
      },
      {
        heading: "Does it work at bedtime, not just in the demo?",
        paragraphs: [
          "Look for the things you'll use every night: a [sleep timer](/help/books-and-listening/sleep-timer-and-speed), [offline downloads](/help/books-and-listening/listen-offline) for trips, a kids' bookshelf that little hands can't wander out of, and words highlighted as the story is read. Readli has all four.",
        ],
      },
      {
        heading: "Try before you decide",
        paragraphs: [
          "You can [hear a story in your own voice for free](/try), with no account or email. The recording is deleted within 24 hours unless you choose to keep it. For side-by-side comparisons with other apps, see [how Readli compares](/vs).",
        ],
      },
    ],
    related: [
      { href: "/vs", label: "How Readli compares" },
      { href: "/parents/safety", label: "Family privacy & safety" },
      { href: "/guides/what-is-a-personalized-audiobook", label: "What is a personalized audiobook?" },
    ],
  },
];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

export function guideHref(g: Pick<Guide, "slug">): string {
  return `/guides/${g.slug}`;
}
