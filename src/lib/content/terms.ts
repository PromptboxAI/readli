/**
 * Readli Terms of Service. Started from Kevin's draft "Readli_Terms_of_Service_Readli_ai_LLC_DRAFT.docx"
 * (2026-10-10) and finalized for publication on 2026-10-23 to describe what the live service does: no AI
 * training on recordings, no third-party licensing, finished stories following the two-approval rule,
 * the paused "delete my voice" control, account deletion, credits, refunds, gifts and complimentary
 * memberships. Kevin's later decisions on training rights, optional licensing and keeping finished
 * stories after a voice is withdrawn are not described here until the code and the Voice Agreement that
 * carry them ship (PR #53). Change this text together with the behaviour it describes.
 */

import type { PolicySection } from "@/lib/content/privacy-policy";

export const TERMS_EFFECTIVE_DATE = "October 23, 2026";

export const TERMS_INTRO: string[] = [
  'These Terms of Service ("Terms") govern access to readli.ai and the Readli Family, Readli Kids, Readli Voice, voice demo, and related services (together, "Readli" or the "Services"), provided by Readli.ai LLC ("Readli," "we," "us," or "our"). By creating an adult account or using the Services, you agree to these Terms and to our Privacy Policy (https://readli.ai/privacy). Parent or guardian consent is required for child-managed experiences as provided below.',
  "Readli generates synthetic narration. Audio produced in a familiar voice is not a recording of that person reading the words live.",
];

export const TERMS_SECTIONS: PolicySection[] = [
  {
    id: "eligibility-and-accounts",
    title: "1. Eligibility and accounts",
    paragraphs: [
      {
        text: "Adult account holders, paying customers, family invitation administrators, and anyone recording or sharing a voice must be at least 18 years old or the legal age of majority where they live, if higher. Children use Readli Kids only through parent- or guardian-managed profiles and may not independently enter contracts or purchase plans.",
      },
      {
        text: "Account holders must provide accurate information, protect their sign-in, and promptly report suspected unauthorized account or voice use to admin@readli.ai. A family relationship or invitation does not, by itself, authorize access to another person’s voice or content.",
      },
    ],
  },
  {
    id: "what-readli-provides",
    title: "2. What Readli provides",
    paragraphs: [
      {
        text: "Readli offers classic children’s books, family invitations, voice recording and AI narration in voices family members choose to share, read-along text, listening progress, and narrator switching. Features may change, be limited, or be labeled beta; not all features are available at all times.",
      },
      {
        text: "Book text, illustrations, translations, and audio may have different rights in different countries and editions. Readli may remove or restrict titles as needed.",
      },
    ],
  },
  {
    id: "voice-recording-and-consent",
    title: "3. Voice recording and consent",
    paragraphs: [
      {
        text: "Recording a voice is voluntary. Before Readli makes a voice from an account recording, you confirm that it is your own voice and that you are the only person recording, that Readli may make a private digital version of your voice to read stories, and that families can use it only after you share it with them and their parents approve it for each child. Readli records your confirmation, the version of the wording you saw, and the time.",
      },
      {
        text: "Do not record, upload, clone, or impersonate another person’s voice. Any rights you own in your original recordings remain yours, and Readli does not acquire ownership of your natural voice.",
      },
      {
        text: "You grant Readli and the service providers that work on its behalf a limited, nonexclusive right to store, process, and transform your recordings, to make a voice model from them with our voice provider, and to generate narration in that voice, only to provide and secure the Services according to your sharing choices and the Privacy Policy.",
      },
      {
        lead: "No AI training or licensing",
        text: "Readli does not use your recordings or your voice model to train or develop AI models, and does not license, sell, or give your recordings or voice model to other companies for their own use. If Readli ever offers either, it will explain it and ask for your separate, express permission first; accepting these Terms is not that permission.",
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
        text: "All family voices are private by default. Recording a voice, accepting a family invitation, or being connected in a family does not make a voice available to any other adult or child.",
      },
      {
        text: "Before a child can see or play a family narrator, two independent permissions must both be in effect: (a) the voice owner shares the voice with that household, and (b) a parent or guardian in that household approves that storyteller for that specific child profile. The household also needs a Readli plan that includes the storyteller.",
      },
      {
        lead: "Stories already prepared",
        text: "Readli checks these permissions each time a story plays. If the voice owner stops sharing with a household, a parent or guardian removes a storyteller from a child, or the household’s plan ends, stories already prepared in that voice stop playing there. They stay stored, and play again if the permissions and plan are restored, unless they have been deleted as section 13 describes. Neither the voice owner nor the parent can override the other’s choice. Children cannot manage these approvals.",
      },
    ],
  },
  {
    id: "children-and-parental-responsibilities",
    title: "5. Children and parental responsibilities",
    paragraphs: [
      {
        text: "Adults creating a child profile represent that they are the parent, legal guardian, or otherwise legally authorized caregiver. They are responsible for the child profile, choosing age-appropriate books, and supervising invitations, approved storytellers, and Kids Mode devices.",
      },
      {
        text: "Readli may seek verifiable parental consent where required and may limit, suspend, or delete a child profile when needed for legal compliance, privacy, or safety. Children may not record a voice for cloning, buy plans, or change parental permissions.",
      },
    ],
  },
  {
    id: "voice-demo",
    title: "6. Voice demo",
    paragraphs: [
      {
        text: "An anonymous voice demo may be available without an account. Before recording, the demo shows a consent notice naming our voice provider and explaining processing and deletion. Demo recordings, the demo voice, and generated demo audio are deleted within 24 hours of recording, as the Privacy Policy describes. Demo availability is not guaranteed and is subject to rate limits and fraud prevention.",
      },
    ],
  },
  {
    id: "plans-payment-and-credits",
    title: "7. Plans, payment, credits and refunds",
    paragraphs: [
      {
        text: "Before you pay, Readli and its payment provider, Stripe, show the price, the billing interval (monthly or yearly), applicable taxes, what the plan includes, and how to cancel. You authorize charges only through that checkout.",
      },
      {
        lead: "Renewal and cancellation",
        text: "Paid plans renew automatically at the end of each billing period at the then-current price until you cancel. You can cancel at any time in Readli Family billing settings or by emailing admin@readli.ai. Cancellation stops future renewals, and you keep access until the end of the period you’ve paid for. Readli gives at least 30 days’ notice before a price increase applies to an existing subscription, and a price never changes during a period you’ve already paid for.",
      },
      {
        lead: "Free trials and rewards",
        text: "When a free trial, referral reward, or other promotion is offered, its length, any card requirement, eligibility limits (such as one per household), and what happens when it ends are shown before you start. Promotions may be limited to one qualifying household.",
      },
      {
        lead: "Narration credits",
        text: "Preparing new narration uses Readli credits; listening to stories already prepared does not. The number of credits a story needs is shown before it is prepared. Readli Family includes a monthly allowance of credits shown on the pricing page; monthly credits refresh each billing month and do not roll over. If narration fails or is stopped before it is finished, the credits for the unfinished part are returned automatically. Trial and monthly credits are available only during the trial or billing month they belong to. Credits have no cash value and cannot be transferred or exchanged for money, unless the law where you live requires otherwise.",
      },
      {
        lead: "Refunds",
        text: "Subscription payments and renewals are not refundable, and there is no refund for unused time or unused credits, including when you cancel or delete your account. Readli corrects duplicate charges and billing errors, and gives any refund the law where you live requires; contact admin@readli.ai. Gift purchases follow the refund terms shown when you buy the gift.",
      },
    ],
  },
  {
    id: "gifts-and-complimentary-memberships",
    title: "8. Invitations, gifts and complimentary memberships",
    paragraphs: [
      {
        text: "Inviting a family member to join Readli, contribute a voice, or connect with your family does not create a paid membership or grant automatic voice access.",
      },
      {
        lead: "Gifts",
        text: "Where available, an adult can buy Readli Family for another household as a fixed-length gift or a recurring monthly gift. The buyer controls their payment method and any recurring gift; the recipient controls their account, children’s profiles, family connections, and voice permissions. A gift never authorizes charges to the recipient. The amount, length, whether it renews, how to stop it, and the refund terms are shown to the buyer before checkout. When a gift ends, the recipient can choose to pay for a plan themselves; otherwise paid access ends.",
      },
      {
        lead: "Complimentary memberships",
        text: "Readli, or a sponsor Readli names, may give complimentary Readli Family memberships, for example at events, schools, charities, raffles, or promotions. Each has a single-use code, a length stated on the certificate (such as 1, 3, or 12 months), and a date by which it must be claimed; an unclaimed code expires after that date. A complimentary membership needs no payment card, does not renew automatically, and nothing is charged when it ends. If your household already has a paid plan, claiming it moves your next billing date back by the complimentary period, with your agreement; if your household already has a membership, the complimentary period starts when that one ends. A complimentary membership has no cash value.",
      },
    ],
  },
  {
    id: "private-and-public-narrator-programs",
    title: "9. Private and public narrator programs",
    paragraphs: [
      {
        text: "Private family voices are never automatically public. Any future public narrator program would be separate from family sharing and would require an express application, review, public-distribution permission, and a separate written agreement.",
      },
    ],
  },
  {
    id: "book-content-and-readli-intellectual-property",
    title: "10. Book content and Readli intellectual property",
    paragraphs: [
      {
        text: "Readli or its licensors retain rights in the Readli software, brand, characters, interfaces, and original platform content. Book texts, illustrations, and translations remain subject to their copyright or public-domain status. Access does not grant permission to redistribute files, synthetic narration, or voice models.",
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
        text: "You may not use Readli to deceive, defraud, harass, exploit children, violate privacy or intellectual-property rights, generate abusive or unlawful audio, scrape books or family content, bypass limits or consent checks, interfere with security, or use a family voice beyond authorized family listening.",
      },
      {
        text: "Readli may investigate reports and restrict narration, remove unauthorized content, or suspend access where appropriate, consistent with applicable law.",
      },
    ],
  },
  {
    id: "service-limitations-and-ai-output",
    title: "12. Service limitations and AI output",
    paragraphs: [
      {
        text: "AI narration may have pronunciation errors, delays, imperfect voice likeness, or problems with sentence highlighting. Readli cannot guarantee uninterrupted service, permanent availability of a particular book, voice, or provider, or error-free output.",
      },
    ],
  },
  {
    id: "your-choices-and-deletion",
    title: "13. Your choices, deletion and suspension",
    paragraphs: [
      {
        lead: "Sharing",
        text: "a voice owner can stop sharing a voice with any household, and a parent or guardian can remove a storyteller from any child, at any time, with the effect section 4 describes.",
      },
      {
        lead: "Replacing your voice",
        text: "you can record again at any time. When you keep a new recording, Readli replaces your voice model with one made from it, and deletes the earlier voice model at our voice provider.",
      },
      {
        lead: "Deleting your voice",
        text: "in-app voice deletion is temporarily unavailable while Readli improves it. To delete your voice now, email admin@readli.ai from your account email. Readli verifies the request, handles it as the law where you live requires, and tells you what was deleted. Deleting your account, below, also deletes your voice.",
      },
      {
        lead: "Deleting your account",
        text: "you can delete your account in account settings. Deletion takes effect immediately and can’t be undone: Readli deletes your voice model at our voice provider, your recordings and voice previews, stories prepared in your voice for any household, your photos, and any household and child profiles that belong to you alone, then your account. If other grown-ups depend on a household you manage, or you pay for a gift, Readli asks you to resolve that first. Readli keeps payment, tax, consent, and security records the law requires or that are needed to resolve disputes.",
      },
      {
        text: "We may suspend or terminate accounts for serious violations, fraud, unauthorized cloning, or legal requirements. What happens to remaining paid time or gifts follows the purchase terms and applicable law.",
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
        text: "These Terms are governed by the laws of the State of New York, subject to mandatory consumer protections that apply where you live. If you have a concern, contact admin@readli.ai first so we can try to resolve it.",
      },
    ],
  },
  {
    id: "changes-and-contact",
    title: "16. Changes and contact",
    paragraphs: [
      {
        text: "We may update these Terms and will post the new version with a new effective date. We will give additional notice, or ask for your consent where the law requires it, before a material change applies to you, especially a change involving voice recordings, children’s information, or paid plans.",
      },
      {
        text: "Readli.ai LLC • 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790 • admin@readli.ai • https://readli.ai",
      },
    ],
  },
];
