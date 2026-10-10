import type { PolicySection } from "@/lib/content/privacy-policy";

/**
 * Readli Terms of Service, first draft written for Kevin's review (2026-10-10). No source copy existed.
 * Section 4 follows the Family Voice Permissions amendment (§7): private by default, owner control,
 * per-child parent approval, both approvals required, either revocable, no access from family connection alone.
 * Must be reviewed by counsel before launch; bracketed placeholders are highlighted on the page.
 */

export const TERMS_EFFECTIVE_DATE = "October 10, 2026";
export const TERMS_DRAFT_NOTE = "This is a working draft for legal review. It is not yet in effect.";

export const TERMS_INTRO: string[] = [
  'These Terms of Service ("Terms") are an agreement between you and Readli.ai LLC ("Readli," "we," "our," or "us"), [POSTAL ADDRESS]. They govern your use of readli.ai, the voice demo, Readli Family, Readli Kids, and related features (together, the "Services").',
  "By creating an account or using the Services you agree to these Terms and acknowledge our Privacy Policy. If you do not agree, please do not use the Services.",
];

export const TERMS_SECTIONS: PolicySection[] = [
  {
    id: "who-can-use-readli",
    title: "1. Who can use Readli",
    paragraphs: [
      {
        text: "You must be at least 18, or the age of majority where you live, to create a Readli account, record or enroll a voice, invite others, or manage a child profile.",
      },
      {
        text: "Children use Readli only through a Readli Kids profile created and managed by their parent or legal guardian. Children cannot create accounts, record voices for cloning, invite adults, or change any voice approvals.",
      },
    ],
  },
  {
    id: "your-account",
    title: "2. Your account",
    paragraphs: [
      {
        text: "Keep your sign-in details secure and tell us promptly at [SUPPORT EMAIL] if you think your account has been used without permission. You are responsible for activity under your account, including the child profiles you manage.",
      },
      {
        text: "Parental controls require authenticated adult access. Do not share your adult sign-in with a child.",
      },
    ],
  },
  {
    id: "your-voice-and-consent",
    title: "3. Your voice and consent",
    paragraphs: [
      {
        text: "Voice cloning is optional. You may record and enroll only your own voice. You must not upload, record, or attempt to clone anyone else's voice, including through an invitation, unless a separately reviewed and lawful authorization process expressly permits it.",
      },
      {
        text: "You keep ownership of your voice and your recordings. You give Readli a limited, revocable permission to process your recordings and create a voice model solely to provide the Services you and the people you approve request, as described in the Privacy Policy. We do not sell family voice recordings or voice models.",
      },
      {
        text: "A cloned voice can generate speech you never personally said. Please understand this before recording and before approving anyone to use your voice.",
      },
    ],
  },
  {
    id: "family-voices-and-parent-approval",
    title: "4. Family voices and parent approval",
    paragraphs: [
      { lead: "Private by default", text: "Every family voice is private when it is created. Recording a voice does not share it with anyone." },
      {
        lead: "Voice owners decide",
        text: "Only the voice owner can choose which household or family members may use their voice, and they can change that choice at any time.",
      },
      {
        lead: "Parents decide for each child",
        text: "A child's parent or guardian separately chooses which shared voices appear in that child's Readli Kids profile. Each newly shared voice starts switched off for every child, and each child's approvals are managed independently.",
      },
      {
        lead: "Both approvals are required",
        text: "A voice appears for a child only while the voice owner has shared it with that household and the parent has approved it for that child. A parent cannot override a voice owner's refusal or withdrawal.",
      },
      {
        lead: "Either approval can be withdrawn",
        text: "If the voice owner or the parent withdraws approval, the voice is removed from that child's storytellers, no new narration is generated, and access to previously generated narration in that voice is blocked for anyone no longer authorized.",
      },
      {
        lead: "Family connections are not permission",
        text: "Joining a family circle, being invited, or appearing in a family tree does not give anyone access to another person's voice recordings or cloned narrations.",
      },
    ],
  },
  {
    id: "voice-demo",
    title: "5. The free voice demo",
    paragraphs: [
      {
        text: "The demo lets you record a short sample and hear a story preview without an account. You may use it only with your own voice. Demo recordings are kept for [VERIFIED PERIOD] and then deleted unless you create an account and choose to save your voice. We may limit demo use to prevent abuse.",
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable use",
    paragraphs: [
      {
        text: "Do not use Readli to impersonate anyone, deceive or defraud anyone, create content that harasses, threatens or sexualizes anyone, target children inappropriately, or generate speech intended to mislead people about what a real person said.",
      },
      {
        text: "Do not attempt to access voices, narrations, or child profiles you are not authorized to use, bypass parental controls or permission checks, scrape or reverse engineer the Services, or interfere with their security or operation.",
      },
      {
        text: "We may remove content, disable a voice, or suspend an account that breaks these Terms or puts families at risk.",
      },
    ],
  },
  {
    id: "books-and-content",
    title: "7. Books and Readli content",
    paragraphs: [
      {
        text: "Readli's library, illustrations, software, and branding are owned by Readli or its licensors. You may use them for personal, non-commercial family listening through the Services. Generated narrations are provided for listening within Readli and may not be downloaded, redistributed, or published unless a feature expressly allows it.",
      },
    ],
  },
  {
    id: "subscriptions-and-payments",
    title: "8. Subscriptions and payments",
    paragraphs: [
      {
        text: "Some features require a paid subscription. Prices, billing periods, renewal terms, trials, and gift or sponsored subscriptions will be shown before you buy. Payments are handled by an independent payment provider. [SUBSCRIPTION TERMS] will be added before paid plans launch.",
      },
    ],
  },
  {
    id: "ending-your-use",
    title: "9. Ending your use",
    paragraphs: [
      {
        text: "You can stop using Readli, delete an enrolled voice, delete a child profile, or close your account at any time through your settings or by contacting [PRIVACY EMAIL]. Deletion follows the retention schedule in the Privacy Policy. We may suspend or end access if you seriously or repeatedly break these Terms, or if required by law.",
      },
    ],
  },
  {
    id: "disclaimers-and-liability",
    title: "10. Disclaimers and limits of liability",
    paragraphs: [
      {
        text: 'The Services are provided "as is" and "as available." AI-generated narration may contain errors in pronunciation, pacing, or tone. To the extent the law allows, Readli is not liable for indirect, incidental, or consequential damages, and our total liability is limited to [LIABILITY CAP]. Nothing in these Terms limits rights you have under consumer protection law that cannot be waived.',
      },
    ],
  },
  {
    id: "disputes-and-governing-law",
    title: "11. Disputes and governing law",
    paragraphs: [
      {
        text: "These Terms are governed by the laws of [GOVERNING LAW STATE], without regard to conflict-of-law rules. Before filing a claim, please contact us at [SUPPORT EMAIL] so we can try to resolve it. [DISPUTE RESOLUTION TERMS]",
      },
    ],
  },
  {
    id: "changes-and-contact",
    title: "12. Changes and contact",
    paragraphs: [
      {
        text: "We will post updated Terms with a new effective date and give additional notice for material changes, especially changes involving children, family voice access, or voice processing.",
      },
      {
        text: "Questions: [SUPPORT EMAIL]. Privacy and parental requests: [PRIVACY EMAIL]. Readli.ai LLC, [POSTAL ADDRESS]. Website: https://readli.ai.",
      },
    ],
  },
];
