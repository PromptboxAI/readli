/**
 * Readli Help Center content (Kevin's Public Help Center amendment, 2026-10-10).
 *
 * Rules from the amendment: plain, reassuring, short answers; no technical terms; never present
 * undecided features as available. Articles about anything not live in production yet (family
 * accounts and sign-in, payments, gifts, credits, rewards) are `draft`: hidden on the live site and
 * shown with a Draft badge in previews and local builds so they can be reviewed before launch.
 * When a feature launches, flip its articles to `published`.
 *
 * Answers support [link text](/path) and bare email addresses.
 */

export type HelpStatus = "published" | "draft";

export type HelpCategory = {
  slug: string;
  title: string;
  blurb: string;
  icon: "home" | "mic" | "book" | "card" | "shield" | "gear";
  tint: string;
};

export type HelpArticle = {
  slug: string;
  category: string;
  question: string;
  /** Short paragraphs. */
  answer: string[];
  status: HelpStatus;
  /** Extra words people might search for. */
  keywords?: string[];
  related?: string[];
};

export const SUPPORT_EMAIL = "admin@readli.ai";

export const HELP_CATEGORIES: HelpCategory[] = [
  { slug: "getting-started", title: "Getting Started", blurb: "What Readli is and how families begin", icon: "home", tint: "bg-sunshine/45" },
  { slug: "voices-and-sharing", title: "Voices & Sharing", blurb: "Record, share and control your voice", icon: "mic", tint: "bg-mint/50" },
  { slug: "books-and-listening", title: "Books & Listening", blurb: "Preparing stories and playback", icon: "book", tint: "bg-sky/35" },
  { slug: "billing-credits-and-gifts", title: "Billing, Credits & Gifts", blurb: "Plans, narration credits and gift memberships", icon: "card", tint: "bg-coral/25" },
  { slug: "privacy-and-child-safety", title: "Privacy & Child Safety", blurb: "Voice permissions and keeping kids safe", icon: "shield", tint: "bg-lavender/50" },
  { slug: "account-and-troubleshooting", title: "Account & Troubleshooting", blurb: "Sign-in, recording and getting in touch", icon: "gear", tint: "bg-wood/40" },
];

const A = (a: HelpArticle) => a;

export const HELP_ARTICLES: HelpArticle[] = [
  // Getting Started
  A({
    slug: "what-is-readli",
    category: "getting-started",
    question: "What is Readli?",
    status: "published",
    answer: [
      "Readli lets children hear classic storybooks read in the voices of the people they love. A parent, grandparent, aunt or family friend records a short reading once, and Readli can then narrate stories in their voice.",
      "You can try it today without signing up: [record your voice](/try) and hear a story read the way only you can.",
    ],
    keywords: ["about", "how it works", "family voices", "storybooks"],
    related: ["readli-family-voice-kids", "is-readli-voice-free", "are-family-voices-private"],
  }),
  A({
    slug: "readli-family-voice-kids",
    category: "getting-started",
    question: "What's the difference between Readli Family, Readli Voice, and Readli Kids?",
    status: "published",
    answer: [
      "Readli Family is the paid household plan. Parents manage the library, their children's profiles and which storytellers each child can hear.",
      "Readli Voice is free. It's for grown-ups who want to share their voice with a family, like a grandparent who lives far away. They record and control their own voice without paying.",
      "Readli Kids isn't a separate account. It's the child-friendly listening space inside Readli Family, where each child picks a book and an approved storyteller.",
    ],
    keywords: ["plans", "accounts", "types", "free", "paid", "difference"],
    related: ["family-plan-included", "is-readli-voice-free", "add-a-child"],
  }),
  A({
    slug: "create-a-family-account",
    category: "getting-started",
    question: "How do I create a family account?",
    status: "draft",
    answer: [
      "Choose Create a Family on the [sign-up page](/signup), enter your details and choose your plan. Once you're in, you can add your children and invite the people you'd love them to hear.",
    ],
    keywords: ["sign up", "register", "join", "start"],
    related: ["add-a-child", "invite-relatives-elsewhere", "family-plan-included"],
  }),
  A({
    slug: "add-a-child",
    category: "getting-started",
    question: "How do I add a child?",
    status: "draft",
    answer: [
      "In Readli Family, open Kids Profiles and choose Add a child. A nickname is all we need. You can add up to six children on one plan at no extra cost.",
      "Each child gets their own bookshelf, listening progress and list of approved storytellers.",
    ],
    keywords: ["child profile", "kids profile", "add kid", "children", "sibling"],
    related: ["approve-narrators-per-child", "multiple-children-listening", "family-plan-included"],
  }),
  A({
    slug: "invite-relatives-elsewhere",
    category: "getting-started",
    question: "Can I invite grandparents or relatives who live elsewhere?",
    status: "draft",
    answer: [
      "Yes. Send an invitation from Readli Family and they'll get a link to join and record their voice from their own phone or computer, wherever they live.",
      "An invitation never shares anyone's voice on its own. They choose whether to share it with your family, and you then choose which of your children can hear it.",
    ],
    keywords: ["invite", "grandma", "grandpa", "far away", "relatives", "long distance"],
    related: ["grandpa-pay-to-share", "invitation-link-not-working", "who-controls-my-voice"],
  }),

  // Voices & Sharing
  A({
    slug: "is-readli-voice-free",
    category: "voices-and-sharing",
    question: "Is Readli Voice free?",
    status: "published",
    answer: [
      "Yes. Sharing your voice with a family is always free. The family that wants to listen has the Readli Family plan, so contributors never need to pay just to share their voice.",
    ],
    keywords: ["cost", "free account", "contributor"],
    related: ["grandpa-pay-to-share", "share-with-more-than-one-family", "record-my-voice"],
  }),
  A({
    slug: "record-my-voice",
    category: "voices-and-sharing",
    question: "How do I record my voice?",
    status: "published",
    answer: [
      "Find a quiet room and use your phone or computer's microphone. Readli shows a short story script that scrolls at your pace, and you simply read it aloud in your usual storytime voice. It takes about a minute or two.",
      "Read it the way you would to a child at bedtime: warm, lively and expressive, not a flat reading voice. Your Readli voice copies how you sound in the recording, so a flat read makes a flat, robotic voice.",
      "You can try this now on the [free voice demo](/try).",
    ],
    keywords: ["record", "microphone", "teleprompter", "script", "how long"],
    related: ["microphone-not-recording", "voice-still-processing", "replace-or-delete-my-voice"],
  }),
  A({
    slug: "grandpa-pay-to-share",
    category: "voices-and-sharing",
    question: "Does Grandpa need to pay to share his voice?",
    status: "published",
    answer: [
      "No. Grandpa can create a free Readli Voice account, record his voice and choose which families can use it. The listening family's plan covers everything else.",
    ],
    keywords: ["grandparent", "free", "contributor", "cost"],
    related: ["is-readli-voice-free", "invite-relatives-elsewhere", "who-controls-my-voice"],
  }),
  A({
    slug: "who-controls-my-voice",
    category: "voices-and-sharing",
    question: "Who controls my recorded voice?",
    status: "published",
    answer: [
      "You do. Your voice is private when you record it. Only you can decide which families may use it, and you can change your mind at any time.",
      "Even after you share, a parent still chooses which of their children can hear you. Nobody can share or use your voice on your behalf.",
    ],
    keywords: ["ownership", "permission", "consent", "my voice"],
    related: ["are-family-voices-private", "revoke-sharing", "replace-or-delete-my-voice"],
  }),
  A({
    slug: "share-with-more-than-one-family",
    category: "voices-and-sharing",
    question: "Can I share my voice with more than one family?",
    status: "draft",
    answer: [
      "Yes. You record once and can share your voice with several households, for example with each of your children's families. You choose each family separately and can stop sharing with one without affecting the others.",
    ],
    keywords: ["multiple families", "households", "grandchildren"],
    related: ["who-controls-my-voice", "revoke-sharing", "is-readli-voice-free"],
  }),
  A({
    slug: "replace-or-delete-my-voice",
    category: "voices-and-sharing",
    question: "Can I replace or delete my voice?",
    status: "draft",
    answer: [
      "Yes. In Readli Family, open My voice and choose Record again to replace your voice with a better take (a quiet room helps). Deleting a voice yourself is paused while we update how finished stories are kept; email admin@readli.ai and we'll delete it for you.",
    ],
    keywords: ["re-record", "remove", "delete voice", "redo"],
    related: ["revoke-sharing", "data-deletion", "record-my-voice"],
  }),
  A({
    slug: "voice-not-available-to-child",
    category: "voices-and-sharing",
    question: "Why isn't a family member's voice available to my child?",
    status: "draft",
    answer: [
      "A family voice only appears for a child when everything below is true:",
      "The voice owner has shared their voice with your family. Your family has a free narrator slot for it. You've approved that storyteller for this particular child.",
      "If any of these is missing, the voice stays hidden from your child. Check Manage Storytellers in Readli Family to see what's needed.",
    ],
    keywords: ["missing", "not showing", "can't find", "storyteller missing"],
    related: ["approve-narrators-per-child", "additional-narrator-slots", "narrator-not-ready"],
  }),
  A({
    slug: "approve-narrators-per-child",
    category: "voices-and-sharing",
    question: "How do I approve narrators for individual children?",
    status: "draft",
    answer: [
      "In Readli Family, open Kids Profiles, choose a child and then Manage Storytellers. Switch on the voices you're happy for that child to hear.",
      "Every newly shared voice starts switched off for every child, and each child's list is separate, so you can make different choices for each of them.",
    ],
    keywords: ["approve", "storytellers", "parental controls", "toggle"],
    related: ["parents-control-voices", "voice-not-available-to-child", "add-a-child"],
  }),

  // Books & Listening
  A({
    slug: "whats-in-the-library",
    category: "books-and-listening",
    question: "What books are in the Readli library?",
    status: "published",
    answer: [
      "Classic children's stories: fairy tales, fables, nursery favorites, bedtime poems and longer chapter books like Winnie-the-Pooh and Heidi. They are public-domain books, so they are free for everyone to read.",
      "Anyone can [browse the library](/books) without an account. Each book's page shows how long it takes to read aloud, its chapters, and how the story starts. Stories run from under a minute to a few hours, and we add new books regularly.",
    ],
    keywords: ["books", "stories", "catalog", "titles", "how long", "length", "minutes", "chapters"],
    related: ["changed-words-in-old-stories", "what-is-readli"],
  }),
  A({
    slug: "changed-words-in-old-stories",
    category: "books-and-listening",
    question: "Why do some stories use different words than the original?",
    status: "published",
    answer: [
      "Many of our stories are more than a hundred years old, and a few of their words have changed meaning or are hurtful today. Before a book joins the library, we read it for those words and swap them for gentle ones that keep the story's sense.",
      "That's why Edward Lear's poem is called The Owl and the Kitty-Cat in Readli. Everything else in the story stays as the author wrote it.",
    ],
    keywords: ["changed", "different", "original", "words", "edited", "pussy-cat", "kitty-cat", "language"],
    related: ["whats-in-the-library"],
  }),
  A({
    slug: "prepare-a-book",
    category: "books-and-listening",
    question: "How do I prepare a book in a family member's voice?",
    status: "draft",
    answer: [
      "Open a book in Readli Family and pick one of your family's storytellers. Readli shows how long the narration is and how many narration credits it will use. Confirm, and Readli prepares it in the background. We'll let you know when it's ready.",
    ],
    keywords: ["generate", "create narration", "prepare narration", "make audiobook"],
    related: ["monthly-narration-credits", "generate-one-chapter", "preparation-failed"],
  }),
  A({
    slug: "switch-narrators-during-story",
    category: "books-and-listening",
    question: "Can my child switch narrators during a story?",
    status: "draft",
    answer: [
      "Yes. Your child can switch between their approved storytellers whenever the next part of the story is ready in that voice. The story carries on from the same sentence, so they never lose their place.",
    ],
    keywords: ["change voice", "switch storyteller", "swap narrator"],
    related: ["narrator-not-ready", "prepare-a-book", "approve-narrators-per-child"],
  }),
  A({
    slug: "narrator-not-ready",
    category: "books-and-listening",
    question: "Why is a narrator showing as \"Not Ready\"?",
    status: "draft",
    answer: [
      "It means that book hasn't been prepared in that voice yet, or it's still being prepared. A parent can prepare it from the book's page in Readli Family. Your child can keep listening with another storyteller in the meantime.",
    ],
    keywords: ["not ready", "preparing", "unavailable", "greyed out"],
    related: ["prepare-a-book", "preparation-failed", "switch-narrators-during-story"],
  }),
  A({
    slug: "not-enough-credits",
    category: "books-and-listening",
    question: "What happens when a book requires more narration credits than I have?",
    status: "draft",
    answer: [
      "Readli tells you how many credits the whole book needs before anything starts. If you don't have enough, you can prepare a single chapter (in books with chapters) or a shorter story instead, or wait for next month's credits.",
    ],
    keywords: ["out of credits", "not enough", "balance"],
    related: ["generate-one-chapter", "monthly-narration-credits", "buy-more-credits"],
  }),
  A({
    slug: "generate-one-chapter",
    category: "books-and-listening",
    question: "Can I generate one chapter instead of an entire book?",
    status: "draft",
    answer: [
      "Yes. For books with chapters you can prepare them one at a time, which uses fewer credits up front. Chapters you've already prepared are kept and never charged again.",
    ],
    keywords: ["chapter", "part", "partial"],
    related: ["not-enough-credits", "prepare-a-book", "replays-use-credits"],
  }),
  A({
    slug: "replays-use-credits",
    category: "books-and-listening",
    question: "Do replays consume narration credits?",
    status: "draft",
    answer: [
      "No. Credits are only used when a new narration is prepared. Listening again, by any of your children, as many times as they like, is always free.",
    ],
    keywords: ["replay", "listen again", "repeat"],
    related: ["monthly-narration-credits", "multiple-children-listening"],
  }),
  A({
    slug: "preparation-failed",
    category: "books-and-listening",
    question: "What happens if preparation fails?",
    status: "draft",
    answer: [
      "Anything that was finished is kept, and any credits for parts that didn't finish are returned to your balance automatically. You can try again from the book's page.",
    ],
    keywords: ["failed", "error", "stuck", "refund"],
    related: ["narrator-not-ready", "report-a-problem", "prepare-a-book"],
  }),
  A({
    slug: "multiple-children-listening",
    category: "books-and-listening",
    question: "Can multiple children listen simultaneously?",
    status: "draft",
    answer: [
      "Yes. Up to three children can listen at the same time on the Readli Family plan, each with their own book, storyteller and place in the story.",
    ],
    keywords: ["siblings", "same time", "concurrent", "devices"],
    related: ["family-plan-included", "add-a-child", "replays-use-credits"],
  }),

  // Billing, Credits & Gifts
  A({
    slug: "family-plan-included",
    category: "billing-credits-and-gifts",
    question: "What's included in the $19.99 Readli Family plan?",
    status: "published",
    answer: [
      "Readli Family will be $19.99 a month, or $179.99 a year. It includes two family storyteller slots, 40 narration credits each month, up to six child profiles, three children listening at the same time, the Readli Kids library, parent-managed storyteller approvals and unlimited family invitations.",
      "See [Pricing](/pricing) for extra storytellers and credit packs.",
      "Each child keeps their own listening history, favorites and progress. Family plans aren't open for sign-up just yet.",
    ],
    keywords: ["price", "cost", "plan", "subscription", "monthly"],
    related: ["readli-family-voice-kids", "additional-narrator-slots", "monthly-narration-credits"],
  }),
  A({
    slug: "additional-narrator-slots",
    category: "billing-credits-and-gifts",
    question: "How do additional narrator slots work?",
    status: "draft",
    answer: [
      "Your plan includes two storyteller slots. Each shared voice you want your children to hear uses one slot. If your family would like more storytellers, you can add extra slots for $5.99 a month each.",
      "Extra slots don't add narration credits, and the relative sharing their voice never pays anything. You can remove an extra slot at any time from your subscription settings.",
    ],
    keywords: ["slots", "more storytellers", "third voice"],
    related: ["family-plan-included", "voice-not-available-to-child"],
  }),
  A({
    slug: "monthly-narration-credits",
    category: "billing-credits-and-gifts",
    question: "How do monthly narration credits work?",
    status: "draft",
    answer: [
      "Your plan comes with 40 narration credits each month, shared by your whole household. One credit prepares 1,000 characters of new narration in your family's voices. Readli shows exactly how many credits a book or chapter will use before you confirm.",
      "Monthly credits refresh each billing cycle and don't roll over. On the annual plan you still get 40 credits each month. Listening to stories you've already prepared never uses credits.",
    ],
    keywords: ["credits", "allowance", "minutes", "balance"],
    related: ["replays-use-credits", "buy-more-credits", "not-enough-credits"],
  }),
  A({
    slug: "buy-more-credits",
    category: "billing-credits-and-gifts",
    question: "How can I purchase more credits?",
    status: "draft",
    answer: [
      "From Narration Credits in Readli Family, choose Get More Narration Credits and pick a pack: 20 credits for $6.99, 50 for $14.99 or 100 for $24.99. If you were preparing a book, you'll go straight back to it afterwards.",
      "Credit packs are one-time purchases for Readli Family households. Your monthly credits are used first.",
    ],
    keywords: ["buy", "top up", "credit pack", "purchase"],
    related: ["monthly-narration-credits", "not-enough-credits"],
  }),
  A({
    slug: "manage-or-cancel-subscription",
    category: "billing-credits-and-gifts",
    question: "How do I manage or cancel my subscription?",
    status: "draft",
    answer: [
      "Go to Billing in Readli Family to update your payment details or cancel. If you cancel, your plan stays active until the end of the period you've paid for and won't renew.",
    ],
    keywords: ["cancel", "billing", "payment method", "stop subscription"],
    related: ["cancel-what-happens-to-voice", "family-plan-included"],
  }),
  A({
    slug: "gift-memberships",
    category: "billing-credits-and-gifts",
    question: "How do gift memberships work?",
    status: "draft",
    answer: [
      "With Invite & Gift you can pay for another family's Readli plan, either for a set time or as a monthly sponsorship. You pay; they manage their own account, children and storytellers. Gifting never gives you access to their family or voices.",
    ],
    keywords: ["gift", "sponsor", "present", "pay for someone"],
    related: ["redeem-a-gift", "manage-or-cancel-subscription"],
  }),
  A({
    slug: "redeem-a-gift",
    category: "billing-credits-and-gifts",
    question: "How do I redeem a gift or complimentary membership?",
    status: "draft",
    answer: [
      "Open the gift link you received, or go to [Redeem a gift](/gift/open) and enter your code. Sign in or create your family account and the membership is added straight away.",
    ],
    keywords: ["redeem", "gift code", "voucher", "complimentary"],
    related: ["gift-memberships", "create-a-family-account"],
  }),
  A({
    slug: "referral-rewards",
    category: "billing-credits-and-gifts",
    question: "How do referral rewards work?",
    status: "draft",
    answer: [
      "Readli Rewards celebrates getting started, like setting up your library and inviting a storyteller. When a family you refer starts a qualifying plan, you may earn a reward. Eligibility rules will be published before rewards launch.",
    ],
    keywords: ["refer", "rewards", "free month", "invite a friend"],
    related: ["gift-memberships", "family-plan-included"],
  }),

  // Privacy & Child Safety
  A({
    slug: "are-family-voices-private",
    category: "privacy-and-child-safety",
    question: "Are family voices private?",
    status: "published",
    answer: [
      "Yes. Every family voice is private by default. Recording a voice, joining a family circle or being invited doesn't share it with anyone. Private family voices are never made public.",
      "Read more about [family privacy & safety](/parents/safety) or our [Privacy Policy](/privacy).",
    ],
    keywords: ["private", "public", "secure", "who can hear"],
    related: ["voice-used-without-permission", "parents-control-voices", "who-controls-my-voice"],
  }),
  A({
    slug: "voice-used-without-permission",
    category: "privacy-and-child-safety",
    question: "Can someone use my voice without permission?",
    status: "published",
    answer: [
      "No. People can only record their own voice, and an invitation never lets anyone upload or copy someone else's. Your voice is only used for the families you've chosen, and only for children their parents have approved.",
      "If you think someone has misused a voice, email admin@readli.ai and we'll look into it straight away.",
    ],
    keywords: ["misuse", "impersonation", "fake", "consent"],
    related: ["are-family-voices-private", "who-controls-my-voice", "report-a-problem"],
  }),
  A({
    slug: "parents-control-voices",
    category: "privacy-and-child-safety",
    question: "Can parents control which voices each child hears?",
    status: "published",
    answer: [
      "Yes. A child only hears a family voice when the voice owner has shared it with your family and you've approved it for that specific child. Each child's approvals are separate, children can't change them, and new voices start switched off.",
    ],
    keywords: ["parental controls", "approve", "child safety", "per child"],
    related: ["approve-narrators-per-child", "are-family-voices-private", "revoke-sharing"],
  }),
  A({
    slug: "revoke-sharing",
    category: "privacy-and-child-safety",
    question: "What happens if I revoke sharing permission?",
    status: "published",
    answer: [
      "Your voice is removed from that family straight away. Their children can no longer choose you as a storyteller, no new stories are prepared in your voice, and stories already prepared in your voice stop playing for them.",
      "If you share again later, every child starts switched off until a parent approves you again.",
    ],
    keywords: ["revoke", "stop sharing", "withdraw", "remove access"],
    related: ["who-controls-my-voice", "replace-or-delete-my-voice", "parents-control-voices"],
  }),
  A({
    slug: "cancel-what-happens-to-voice",
    category: "privacy-and-child-safety",
    question: "What happens to my voice and saved narrations if I cancel?",
    status: "draft",
    answer: [
      "If your family plan ends, your children stop listening to family narrations, but your family's own voices still belong to the people who recorded them. Anyone can delete their voice at any time. How long other information is kept is explained in our [Privacy Policy](/privacy).",
    ],
    keywords: ["cancel", "keep", "saved stories", "end plan"],
    related: ["data-deletion", "manage-or-cancel-subscription", "replace-or-delete-my-voice"],
  }),
  A({
    slug: "data-deletion",
    category: "privacy-and-child-safety",
    question: "How do I request deletion of personal data?",
    status: "published",
    answer: [
      "Email admin@readli.ai from the address on your account and tell us what you'd like deleted, such as a voice recording, a child's profile or your whole account. We may need to confirm it's you, or that you're the child's parent or guardian, before we act.",
      "Our [Privacy Policy](/privacy) explains what we keep and for how long.",
    ],
    keywords: ["delete", "erase", "remove data", "gdpr", "privacy request"],
    related: ["replace-or-delete-my-voice", "are-family-voices-private", "contact-readli"],
  }),

  // Account & Troubleshooting
  A({
    slug: "cant-sign-in",
    category: "account-and-troubleshooting",
    question: "I can't sign in.",
    status: "draft",
    answer: [
      "Check you're using the same email or Google account you signed up with. If you've forgotten your password, choose Forgot password on the sign-in page. Still stuck? Email admin@readli.ai and we'll help.",
    ],
    keywords: ["login", "password", "locked out", "sign in"],
    related: ["contact-readli", "invitation-link-not-working"],
  }),
  A({
    slug: "invitation-link-not-working",
    category: "account-and-troubleshooting",
    question: "My invitation link isn't working.",
    status: "draft",
    answer: [
      "Invitation links can expire or be cancelled by the person who sent them. Ask them to send a new invitation from Readli Family. If you already have a Readli account, sign in first and then open the link.",
    ],
    keywords: ["invite link", "expired", "invitation"],
    related: ["invite-relatives-elsewhere", "cant-sign-in"],
  }),
  A({
    slug: "microphone-not-recording",
    category: "account-and-troubleshooting",
    question: "My microphone isn't recording.",
    status: "published",
    answer: [
      "When your browser asks, choose Allow for the microphone. If you said no by mistake, open your browser's site settings for readli.ai and turn the microphone on, then reload the page.",
      "Close other apps that might be using the microphone, like video calls, and make sure the right microphone is selected. If it still doesn't work, try another browser or device, or email admin@readli.ai.",
    ],
    keywords: ["mic", "permission", "no sound", "recording not working", "blocked"],
    related: ["record-my-voice", "voice-still-processing", "contact-readli"],
  }),
  A({
    slug: "voice-still-processing",
    category: "account-and-troubleshooting",
    question: "My voice is still processing.",
    status: "published",
    answer: [
      "Creating your voice usually takes a moment after you finish recording. Keep the page open until it's done. If it's been more than a few minutes, reload the page and try again, or email admin@readli.ai.",
    ],
    keywords: ["processing", "waiting", "stuck", "loading"],
    related: ["record-my-voice", "microphone-not-recording", "report-a-problem"],
  }),
  A({
    slug: "audiobook-not-playing",
    category: "account-and-troubleshooting",
    question: "My audiobook isn't playing.",
    status: "published",
    answer: [
      "Check your device isn't muted and the volume is up, and that you're connected to the internet. On phones, the silent switch can also mute stories. Reloading the page fixes most hiccups.",
      "Still no sound? Try another browser or device, or email admin@readli.ai.",
    ],
    keywords: ["no sound", "won't play", "audio", "playback"],
    related: ["report-a-problem", "contact-readli"],
  }),
  A({
    slug: "report-a-problem",
    category: "account-and-troubleshooting",
    question: "How do I report a problem?",
    status: "published",
    answer: [
      "Email admin@readli.ai and tell us what happened, which page or feature you were using, and your device and browser. A screenshot helps too. Please don't send passwords, payment card details or recordings of children.",
    ],
    keywords: ["bug", "issue", "feedback", "something wrong"],
    related: ["contact-readli", "voice-used-without-permission"],
  }),
  A({
    slug: "contact-readli",
    category: "account-and-troubleshooting",
    question: "How do I contact Readli?",
    status: "published",
    answer: [
      "Email us at admin@readli.ai. We're a small, friendly team and we read every message.",
      "Our postal address is Readli.ai LLC, 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790.",
    ],
    keywords: ["email", "support", "help", "address", "phone"],
    related: ["report-a-problem", "data-deletion"],
  }),
];
