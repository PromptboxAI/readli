/**
 * Readli Terms of Service, from Kevin's draft "Readli_Terms_of_Service_Readli_ai_LLC_DRAFT.docx" (2026-10-10).
 * Not published from the draft: the internal "Pre-publication verification" checklist and the two
 * [COUNSEL REVIEW REQUIRED] notes (§14: whether to add a liability cap and exclusions; §15: courts or dispute
 * process, consumer notices, and whether arbitration is appropriate). Counsel must review before launch.
 * 2026-10-11: voice-rights amendment (Kevin): recording, development and licensing rights, provider substitution,
 * contributor representations, payment and Archive entitlements, credit expiry, generated content, business
 * transfers and withdrawal. Sections renumbered.
 */

import type { PolicySection } from "@/lib/content/privacy-policy";

/** The draft says to set the real effective date when it is published. */
export const TERMS_EFFECTIVE_DATE = "October 11, 2026";

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
    id: "contributor-representations",
    title: "3. Voice enrollment and contributor representations",
    paragraphs: [
      {
        text: "Voice enrollment is voluntary. Before the microphone starts, Readli shows the Voice Recording & AI Training Agreement (https://readli.ai/voice-agreement) and records your acceptance, the agreement version, the permissions you granted, and the time.",
      },
      {
        text: "By recording, you represent that: you are at least 18 years old or the age of majority where you live, if higher; the voice is your own and no one else is speaking; you have the right to grant the permissions you select; you are not recording to impersonate anyone; and the information you give Readli about yourself is accurate. Do not clone, upload, or impersonate another person’s voice without a separately approved lawful authorization process.",
      },
      {
        text: "Generated narration is synthetic. It must not be used to deceive others into believing a person spoke words they did not actually say, including for fraudulent endorsements, harassment, scams, or other unlawful impersonation.",
      },
    ],
  },
  {
    id: "voice-recording-ai-development-and-data-rights",
    title: "4. Voice recording, AI development and data rights",
    paragraphs: [
      {
        text: "By creating and recording a Readli Voice profile, you authorize Readli to collect, record, store, process, reproduce, modify, enhance, and use your submitted voice recordings for the purpose of operating, developing, maintaining, improving, and providing Readli’s products and services.",
      },
      {
        text: "This authorization includes creating and recreating synthetic voice models, improving voice quality, supporting new languages and voice technologies, restoring voice models, conducting quality assurance, and developing or training proprietary voice-generation technologies.",
      },
      {
        text: "Readli may engage authorized technology providers, contractors, successors, and affiliates to perform these activities, subject to applicable law and appropriate data protection and security requirements.",
      },
      {
        lead: "Readli service rights",
        text: "store, clone, re-clone, improve and generate narrated stories using your original recording. Part of the standard Readli Voice agreement.",
      },
      {
        lead: "Readli technology development rights",
        text: "use your original recordings to develop, train, evaluate and improve Readli-owned voice-generation systems, including through third-party processors working on Readli’s behalf. Part of the standard Readli Voice agreement, subject to applicable law.",
      },
      {
        lead: "Independent commercial licensing rights",
        text: "license your original recordings to other companies for their own AI model development and training, only where you have given the required specific authorization. This is a separate opt-in that is off by default. Any licensing of identifiable voice recordings to third parties for their independent model training or commercial development will be subject to a separate, clearly disclosed authorization where required.",
      },
      {
        text: "These rights cover the original recordings you make with Readli. Readli records the permissions granted for each contributor and each recording. Children’s voices and personal information are never included in a third-party training dataset.",
      },
      {
        text: "Readli owns its independently developed software, systems, proprietary models, and intellectual property, together with any rights it lawfully acquires in recordings and generated content. Nothing in this agreement transfers ownership of your natural voice or personal identity as a whole.",
      },
      {
        text: "All rights and authorizations are subject to applicable law, platform policies, and legally required withdrawal, deletion, and privacy rights.",
      },
    ],
  },
  {
    id: "ongoing-improvements-and-provider-changes",
    title: "5. Ongoing technical improvements and provider changes",
    paragraphs: [
      {
        text: "Readli may re-create your voice from your original recording when voice technology improves, when a model must be restored, when new languages or features become available, or when Readli changes or adds speech-processing providers. A re-created voice may sound different from an earlier one.",
      },
      {
        text: "Readli may replace or add technology providers (for example, a different voice-generation provider) without asking for new consent, provided the new provider processes recordings only on Readli’s behalf under appropriate data protection and security terms. The Privacy Policy lists current providers.",
      },
    ],
  },
  {
    id: "private-family-voices-and-child-level-approval",
    title: "6. Private family voices and child-level approval",
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
    title: "7. Children and parental responsibilities",
    paragraphs: [
      {
        text: "Adults creating a child profile represent that they are the parent, legal guardian, or otherwise legally authorized caregiver. They are responsible for child profile accuracy, selecting age-appropriate content, and supervising invitations and approved narrators.",
      },
      {
        text: "Readli may seek verifiable parental consent where required and may limit, suspend, or delete a child profile when needed for legal compliance, privacy, or safety. Children may not grant voice licenses, buy subscriptions, or independently change parental permissions.",
      },
      {
        text: "Readli does not create voice clones of children, and never includes children’s voices or children’s personal information in a dataset licensed to or used by a third party for its own model training.",
      },
    ],
  },
  {
    id: "public-demo",
    title: "8. Public demo",
    paragraphs: [
      {
        text: "An anonymous voice preview may be available subject to a recording consent notice, provider disclosures, short-term retention, rate limits, and fraud prevention measures. Preview availability is not guaranteed; the Privacy Policy explains the actual processing and deletion practices. Demo recordings are used only to make the preview and are not used to develop Readli technology or licensed to anyone.",
      },
    ],
  },
  {
    id: "subscriptions-trials-and-cancellation",
    title: "9. Subscriptions, payment, credits and the Archive",
    paragraphs: [
      {
        text: "When paid plans launch, the checkout page will present the then-current price, included features, recurring billing interval, applicable taxes, any usage quotas, trial conditions, how to cancel, and refund rules. You authorize charges only through a clearly disclosed checkout process.",
      },
      {
        text: "Unless the applicable checkout terms or law provide otherwise, cancellation stops future renewals at the end of the current paid period. Free-month offers, promotional eligibility, and referral rewards require separate published rules and may be restricted to one qualifying household.",
      },
      {
        lead: "Narration credits",
        text: "New narration is paid for in Readli credits, which the checkout and the parent library show before anything is generated. Credits expire on a published schedule: a plan’s monthly allowance is available for its billing period and does not roll over unless stated; promotional credits, such as welcome credits, expire 30 days after they are granted unless the offer says otherwise; purchased credits expire 12 months after purchase. The soonest-expiring credits are used first. Expired credits have no cash value and are not refunded unless the law requires it.",
      },
      {
        lead: "The Archive",
        text: "Narration a household has already generated and stored is its Archive. An active plan includes listening to the Archive for voices that are still shared with and approved for the household. Having audio in the Archive and permission to generate new narration are separate entitlements: the Archive does not include a right to create new audio, export voice models, or keep a voice available after its owner withdraws it. When a plan, gift or sponsorship ends, the household keeps listening access to its Archive for 30 days; after that, access expires and Readli may delete the stored narration. Renewing within the 30 days restores access.",
      },
    ],
  },
  {
    id: "invite-family-invite-gift-and-sponsored-subscriptions",
    title: "10. Invite Family, Invite & Gift, and sponsored subscriptions",
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
    title: "11. Private and public narrator programs",
    paragraphs: [
      {
        text: "Enhanced private-voice offerings may require additional samples, verification, fees, and consent. Any future Public Narrator marketplace is separate from family sharing and will require express application, review, public-distribution permission, and a separate written license or compensation agreement. Private family voices are never automatically public.",
      },
    ],
  },
  {
    id: "generated-content",
    title: "12. Generated content",
    paragraphs: [
      {
        text: "Narration Readli generates is synthetic audio produced by Readli’s systems and providers. Readli or its licensors hold the rights that exist in generated audio files, together with any rights Readli lawfully acquires in them; book text remains subject to its own copyright or public-domain status. Households receive a personal, noncommercial, revocable right to listen to narration they are authorized to hear, inside Readli.",
      },
      {
        text: "Generated narration is not an original recording of the contributor. Readli’s development and licensing rights described in section 4 apply to contributors’ original recordings, not to narration produced by third-party providers. Generated narration may not be downloaded, redistributed, or used to train other models except as Readli expressly allows.",
      },
    ],
  },
  {
    id: "book-content-and-readli-intellectual-property",
    title: "13. Book content and Readli intellectual property",
    paragraphs: [
      {
        text: "Readli or its licensors retain rights in the Readli software, systems, proprietary models, brand, mascot, interfaces, and original platform content. Book texts, illustrations, and translations remain subject to their respective copyright or public-domain status. Access does not grant permission to redistribute files, synthetic narrations, or cloned models.",
      },
      {
        text: "Except where expressly licensed otherwise, the Services are for personal, noncommercial family listening.",
      },
    ],
  },
  {
    id: "prohibited-uses-and-safety",
    title: "14. Prohibited uses and safety",
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
    title: "15. Service limitations and AI output",
    paragraphs: [
      {
        text: "AI narration may have pronunciation errors, delays, imperfect voice likeness, or problems with sentence synchronization. Readli cannot guarantee uninterrupted service, permanent availability of a particular book, voice model, or provider, or error-free output.",
      },
    ],
  },
  {
    id: "withdrawing-permissions",
    title: "16. Withdrawing permissions",
    paragraphs: [
      {
        lead: "Sharing",
        text: "a voice owner can stop sharing a voice with any household, and a parent or guardian can remove a voice from any child, at any time, as section 6 describes.",
      },
      {
        lead: "Independent commercial licensing",
        text: "you can turn this optional permission off at any time. That stops new licensing of your recordings; recordings already licensed under your earlier authorization may continue to be used by the licensee as that license allows, unless the law requires otherwise.",
      },
      {
        lead: "Service and Readli development rights",
        text: "these are a condition of using Readli Voice. You can withdraw them by deleting your voice (in Readli Family, under My voice) or your account. That removes your voice from every family at once, stops Readli from making new narration in it, deletes the narration already made in it and your original recordings as the Privacy Policy describes, and is recorded as a withdrawal. Models or systems already trained may not be able to remove what they learned from a recording. You can record a new voice later, which needs a new agreement.",
      },
      {
        lead: "Where the law requires",
        text: "Readli will honor any legally required withdrawal, deletion, or privacy right, including rights that apply to biometric or voice data where you live. Contact admin@readli.ai.",
      },
      {
        text: "Readli may keep the record of what you agreed to, when, and what you later withdrew, for as long as needed to show which uses were authorized, comply with law, and resolve disputes.",
      },
    ],
  },
  {
    id: "privacy-suspension-and-deletion",
    title: "17. Privacy, suspension and deletion",
    paragraphs: [
      {
        text: "Our Privacy Policy describes processing of recordings, children’s information, consent records, and account data. You may request deletion or withdraw applicable authorizations as section 16 describes, using available controls or by contacting admin@readli.ai. Some information may be retained as required by law or for legitimate security and dispute purposes.",
      },
      {
        text: "We may suspend or terminate accounts for serious violations, fraud, unauthorized cloning, or legal requirements. Details concerning remaining subscriptions, gifted access, credits and the Archive depend on applicable purchase terms and law.",
      },
    ],
  },
  {
    id: "business-transfers",
    title: "18. Business transfers",
    paragraphs: [
      {
        text: "Readli may transfer its business assets, intellectual property, contractual rights, and associated authorized data in connection with a merger, acquisition, restructuring, financing, or sale of the business, subject to applicable privacy and other legal obligations.",
      },
      {
        text: "Any successor receives recordings together with the permissions recorded for each contributor and remains bound by them. A transfer does not expand the permissions you granted, and does not authorize an unrelated sale of children’s personal information or private family voice models.",
      },
    ],
  },
  {
    id: "warranties-and-liability",
    title: "19. Warranties and liability",
    paragraphs: [
      {
        text: "To the extent permitted by law, the Services are provided on an “as available” basis without a promise of uninterrupted or error-free operation. Nothing in these Terms limits consumer protections, warranties, or rights that cannot lawfully be excluded.",
      },
    ],
  },
  {
    id: "governing-law-and-disputes",
    title: "20. Governing law and disputes",
    paragraphs: [
      {
        text: "These Terms are intended to be governed by the laws of New York, subject to mandatory consumer protections that apply where you live.",
      },
    ],
  },
  {
    id: "changes-and-contact",
    title: "21. Changes and contact",
    paragraphs: [
      {
        text: "We may update the Terms and post a new effective date. We will give additional notice or request consent when required for material changes, and we will ask for your agreement again before using your recordings in a way your recorded permissions do not already cover.",
      },
      {
        text: "Readli.ai LLC • 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790 • admin@readli.ai • https://readli.ai",
      },
    ],
  },
];
