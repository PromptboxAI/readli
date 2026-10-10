/**
 * Readli Terms of Service, from Kevin's draft "Readli_Terms_of_Service_Readli_ai_LLC_DRAFT.docx" (2026-10-10).
 * Not published from the draft: the internal "Pre-publication verification" checklist and the two
 * [COUNSEL REVIEW REQUIRED] notes (§14: whether to add a liability cap and exclusions; §15: courts or dispute
 * process, consumer notices, and whether arbitration is appropriate). Counsel must review before launch.
 */

import type { PolicySection } from "@/lib/content/privacy-policy";

/** The draft says to set the real effective date when it is published. */
export const TERMS_EFFECTIVE_DATE = "October 10, 2026";

export const TERMS_INTRO: string[] = [
  'These Terms of Service ("Terms") govern access to readli.ai and the Readli Family, Readli Kids, voice preview, and related services (together, "Readli" or the "Services"), provided by Readli.ai LLC ("Readli," "we," "us," or "our"). By creating an adult account or using the Services, you agree to these Terms. Parent or guardian consent is required for child-managed experiences as provided below.',
  "Readli generates synthetic narration. Audio produced in a familiar voice is not a recording of that person reading the words live.",
];

export const TERMS_SECTIONS: PolicySection[] = [
  {
    id: "eligibility-and-accounts",
    title: "1. Eligibility and accounts",
    paragraphs: [
      {
        text: "Adult account holders, paying customers, family invitation administrators, and persons licensing or approving voice sharing must be at least 18 years old or the legal age of majority where they live, if higher. Children use Readli Kids only through parent- or guardian-managed profiles and may not independently enter contracts or purchase plans.",
      },
      {
        text: "Account holders must provide accurate information, protect credentials, and promptly report suspected unauthorized account or voice use. A family relationship or invitation does not, by itself, authorize access to another person’s voice or content.",
      },
    ],
  },
  {
    id: "what-readli-provides",
    title: "2. What Readli provides",
    paragraphs: [
      {
        text: "Subject to availability and rights clearance, Readli may offer classic books, family-circle invitations, AI voice enrollment and narration, narrated previews, read-along text highlighting, book progress, and narrator switching. Features may change, be limited, or be labeled beta; not all features are available at all times.",
      },
      {
        text: "Book text, illustrations, translations, and audio may have different rights in different countries and editions. Readli may remove or restrict titles as needed.",
      },
    ],
  },
  {
    id: "voice-enrollment-consent-and-ownership",
    title: "3. Voice enrollment, consent and ownership",
    paragraphs: [
      {
        text: "Voice enrollment is voluntary. You may submit your own voice only with informed consent and any required identity verification. Do not clone, upload, or impersonate another person’s voice without a separately approved lawful authorization process. Any rights you own in submitted original recordings remain yours.",
      },
      {
        text: "You grant Readli and necessary service providers a limited, nonexclusive right to process, store, transform, and synthesize the recordings and authorized narration only to provide and secure the Services in accordance with your choices and the Privacy Policy. Readli does not acquire ownership of your natural voice.",
      },
      {
        text: "Generated narration is synthetic. It must not be used to deceive others into believing a person spoke words they did not actually say, including for fraudulent endorsements, harassment, scams, or other unlawful impersonation.",
      },
    ],
  },
  {
    id: "private-family-voices-and-child-level-approval",
    title: "4. Private family voices and child-level approval",
    paragraphs: [
      {
        text: "All family voices are private by default. Voice recording, acceptance of a family invitation, or membership in a family tree does not automatically make a voice available to any other adult or child.",
      },
      {
        text: "Before a child can see or play a family narrator, two independent permissions must remain in effect: (a) the voice owner affirmatively allows the relevant family or household to use the voice, and (b) an authorized parent or guardian enables that storyteller for that specific child profile.",
      },
      {
        text: "The voice owner may revoke their authorization; a parent or guardian may remove a voice from a child profile. Neither party can override the other. Readli may block new narration requests and access to existing generated audio following revocation, subject to legally required preservation and reasonable technical limitations. Children cannot manage these approvals.",
      },
    ],
  },
  {
    id: "children-and-parental-responsibilities",
    title: "5. Children and parental responsibilities",
    paragraphs: [
      {
        text: "Adults creating a child profile represent that they are the parent, legal guardian, or otherwise legally authorized caregiver. They are responsible for child profile accuracy, selecting age-appropriate content, and supervising invitations and approved narrators.",
      },
      {
        text: "Readli may seek verifiable parental consent where required and may limit, suspend, or delete a child profile when needed for legal compliance, privacy, or safety. Children may not grant voice licenses, buy subscriptions, or independently change parental permissions.",
      },
    ],
  },
  {
    id: "public-demo",
    title: "6. Public demo",
    paragraphs: [
      {
        text: "An anonymous voice preview may be available subject to a recording consent notice, provider disclosures, short-term retention, rate limits, and fraud prevention measures. Preview availability is not guaranteed; the Privacy Policy explains the actual processing and deletion practices.",
      },
    ],
  },
  {
    id: "subscriptions-trials-and-cancellation",
    title: "7. Subscriptions, trials and cancellation",
    paragraphs: [
      {
        text: "When paid plans launch, the checkout page will present the then-current price, included features, recurring billing interval, applicable taxes, any usage quotas, trial conditions, how to cancel, and refund rules. You authorize charges only through a clearly disclosed checkout process.",
      },
      {
        text: "Unless the applicable checkout terms or law provide otherwise, cancellation stops future renewals at the end of the current paid period. Free-month offers, promotional eligibility, and referral rewards require separate published rules and may be restricted to one qualifying household.",
      },
    ],
  },
  {
    id: "invite-family-invite-gift-and-sponsored-subscriptions",
    title: "8. Invite Family, Invite & Gift, and sponsored subscriptions",
    paragraphs: [
      {
        text: "Inviting a family member to join Readli, contribute a voice, or accept a family-tree connection does not create a paid membership or grant automatic voice access.",
      },
      {
        text: 'If available, "Invite & Gift" permits an adult purchaser to pay for another adult’s or household’s plan using a fixed-duration gift or a recurring sponsorship. The buyer controls their payment method and recurring sponsorship; the recipient retains control of their account, children’s profiles, family connections, and voice permissions.',
      },
      {
        text: "Fixed-term gifts do not authorize charges to the recipient. Recurring gifts must clearly disclose the amount, frequency, renewal, and cancellation method to the purchaser before checkout. Cancellation or payment failure may end sponsored access after notice or an applicable grace period; recipients may be offered the option to pay independently. Refunds and redemption periods are disclosed at purchase.",
      },
    ],
  },
  {
    id: "private-and-public-narrator-programs",
    title: "9. Private and public narrator programs",
    paragraphs: [
      {
        text: "Enhanced private-voice offerings may require additional samples, verification, fees, and consent. Any future Public Narrator marketplace is separate from family sharing and will require express application, review, public-distribution permission, and a separate written license or compensation agreement. Private family voices are never automatically public.",
      },
    ],
  },
  {
    id: "book-content-and-readli-intellectual-property",
    title: "10. Book content and Readli intellectual property",
    paragraphs: [
      {
        text: "Readli or its licensors retain rights in the Readli software, brand, mascot, interfaces, and original platform content. Book texts, illustrations, and translations remain subject to their respective copyright or public-domain status. Access does not grant permission to redistribute files, synthetic narrations, or cloned models.",
      },
      {
        text: "Except where expressly licensed otherwise, the Services are for personal, noncommercial family listening.",
      },
    ],
  },
  {
    id: "prohibited-uses-and-safety",
    title: "11. Prohibited uses and safety",
    paragraphs: [
      {
        text: "You may not use Readli to deceive, defraud, harass, exploit children, violate privacy or intellectual-property rights, generate abusive or unlawful audio, scrape books or family content, bypass quotas or consent checks, interfere with security, or use a private cloned voice beyond authorized family listening.",
      },
      {
        text: "Readli may investigate reports and restrict generation, remove unauthorized content, or suspend access where appropriate, consistent with applicable law.",
      },
    ],
  },
  {
    id: "service-limitations-and-ai-output",
    title: "12. Service limitations and AI output",
    paragraphs: [
      {
        text: "AI narration may have pronunciation errors, delays, imperfect voice likeness, or problems with sentence synchronization. Readli cannot guarantee uninterrupted service, permanent availability of a particular book, voice model, or provider, or error-free output.",
      },
    ],
  },
  {
    id: "privacy-suspension-and-deletion",
    title: "13. Privacy, suspension and deletion",
    paragraphs: [
      {
        text: "Our Privacy Policy describes processing of recordings, children’s information, consent records, and account data. You may request deletion or withdraw applicable authorizations using available controls or by contacting admin@readli.ai. Some information may be retained as required by law or for legitimate security and dispute purposes.",
      },
      {
        text: "We may suspend or terminate accounts for serious violations, fraud, unauthorized cloning, or legal requirements. Details concerning remaining subscriptions or gifted access depend on applicable purchase terms and law.",
      },
    ],
  },
  {
    id: "warranties-and-liability",
    title: "14. Warranties and liability",
    paragraphs: [
      {
        text: "To the extent permitted by law, the Services are provided on an “as available” basis without a promise of uninterrupted or error-free operation. Nothing in these Terms limits consumer protections, warranties, or rights that cannot lawfully be excluded.",
      },
    ],
  },
  {
    id: "governing-law-and-disputes",
    title: "15. Governing law and disputes",
    paragraphs: [
      {
        text: "These Terms are intended to be governed by the laws of New York, subject to mandatory consumer protections that apply where you live.",
      },
    ],
  },
  {
    id: "changes-and-contact",
    title: "16. Changes and contact",
    paragraphs: [
      {
        text: "We may update the Terms and post a new effective date. We will give additional notice or request consent when required for material changes.",
      },
      {
        text: "Readli.ai LLC • 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790 • admin@readli.ai • https://readli.ai",
      },
    ],
  },
];
