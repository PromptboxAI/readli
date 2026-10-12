/**
 * Readli Terms of Service, from Kevin's draft "Readli_Terms_of_Service_Readli_ai_LLC_DRAFT.docx" (2026-10-10).
 * Not published from the draft: the internal "Pre-publication verification" checklist and the two
 * [COUNSEL REVIEW REQUIRED] notes (§14: whether to add a liability cap and exclusions; §15: courts or dispute
 * process, consumer notices, and whether arbitration is appropriate). Counsel must review before launch.
 * 2026-10-11: voice-rights amendment (Kevin): recording, development and licensing rights, provider substitution,
 * contributor representations, payment and Archive entitlements, credit expiry, generated content, business
 * transfers and withdrawal. Sections renumbered.
 * 2026-10-12: Kevin's answers on plan changes, trials, account deletion and the three voice actions (§9, §13), then his
 * final business policy decisions: refunds, purchased credits, price-increase notice, the trial reminder, no
 * contributor payment and the conditions for third-party licensing (§4, §9).
 */

import type { PolicySection } from "@/lib/content/privacy-policy";
import { VOICE_CHOICES } from "@/lib/content/voice-agreement";

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
        text: "use your original recordings to develop, train, evaluate and improve Readli-owned voice-generation systems, including through third-party processors working on Readli’s behalf. Part of the standard Readli Voice agreement, subject to applicable law. You can withdraw it later without losing your story voice, as section 16 describes.",
      },
      {
        lead: "Independent commercial licensing rights",
        text: "license your eligible original recordings to independent AI companies for their own model development and training, only with your separate, affirmative authorization under the Voice Recording & AI Training Agreement; accepting these Terms is not enough. This is a separate opt-in that is off by default, offered only where the law allows it. Each license must define the approved uses, security, retention, onward transfer and sublicensing, and forbid using the recordings to impersonate you. Readli has not started licensing recordings and will not without a separate launch decision.",
      },
      {
        text: "These rights cover the original recordings you make with Readli. Readli records the permissions granted for each contributor and each recording. Children’s voices and personal information, anonymous guest demo recordings and narration generated by Readli’s voice provider are never included in a third-party training dataset.",
      },
      {
        lead: "No payment",
        text: "Readli Voice contributors volunteer their voices and are not paid: there are no recording fees, royalties, residuals or revenue-sharing payments under the standard Readli Voice agreement, including for licensing. Any future paid recording program would use a separate agreement.",
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
        text: "The voice owner may revoke their authorization for a household; a parent or guardian may remove a voice from a child profile. Neither party can override the other. After either change, Readli stops new narration in that voice and access to stories already prepared in it for that household or child, subject to legally required preservation and reasonable technical limitations. Children cannot manage these approvals.",
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
        lead: "Changing plan",
        text: "Readli shows the effective date, any adjustment and the resulting amount before you confirm a plan change. Moving to a more expensive plan or to yearly billing takes effect once that payment goes through, and is charged then, less a credit for the unused part of your current period. Moving to a less expensive plan, such as from Readli Family to Readli Family Archive, takes effect at the end of the period you’ve already paid for unless you choose to switch now; switching now adds a credit for the unused time to your account, which pays future bills. Account credit isn’t paid out in cash unless the law where you live requires it; if your subscription ends with credit left, it stays on your billing account and applies if you subscribe again. During a free trial you can choose monthly or yearly billing without shortening the trial; a move to a less expensive plan waits until the trial ends; and Readli ends a trial early only if you ask to start paying now and confirm it. Deleting your account immediately cancels a plan only you belong to and stops any gift you pay for from renewing; unused paid time and unused credits are not refunded unless the law where you live requires it, and a gift recipient keeps the period already paid for.",
      },
      {
        lead: "Renewal and cancellation",
        text: "Paid plans renew automatically at the end of each billing period, monthly or yearly as you chose, at the then-current price, until you cancel. A free trial turns into a paid Readli Family subscription when it ends unless you cancel before then. You can cancel online at any time in Readli Family billing settings, or by contacting admin@readli.ai. Unless the applicable checkout terms or law provide otherwise, cancellation stops future renewals and you keep access until the end of the current paid period. A free trial’s reminder email goes out 3 days before it ends, with the end date, the next billing date, the exact amount, whether you chose monthly or yearly billing, and a link to cancel; signing up for a trial doesn’t sign you up for promotional email. Readli gives at least 30 days’ notice (longer where the law requires) before a price increase applies to your subscription, naming the old price, the new price, the date, your billing frequency and how to cancel. A price never changes during a period you’ve already paid for or a prepaid gift term, and Readli asks for your consent before charging a higher price where the law requires it. Free-month offers, promotional eligibility, and referral rewards require separate published rules and may be restricted to one qualifying household.",
      },
      {
        lead: "Narration credits",
        text: "New narration is paid for in Readli credits, which the checkout and the parent library show before anything is generated. Readli Family is currently $19.99 a month or $179.99 a year and includes 40 credits each month; credit packs are currently 20 credits for $6.99, 50 for $14.99 and 100 for $24.99. If a price or credit amount here differs from what checkout showed you when you bought, the checkout governs. A household’s first Readli Family subscription starts with a 14-day free trial that includes 10 credits, available until the trial ends; the plan’s monthly credits start when the first paid period does. The trial is offered once per eligible household and account, needs a verified email address and a payment card, and isn’t offered again to the same email address; a card that has already started a trial for another household starts Readli Family without the trial credits. Readli limits how many narration requests a household can make in a short time (more tightly during a trial), how much one request and one day can include, and how many can run at once, and may pause new requests for everyone for a while to protect the service. A plan’s monthly credits are available for that billing period and do not roll over unless stated. Purchased credits do not expire while your account is active. Promotional credits, such as welcome credits, do not expire unless the offer said otherwise when they were granted. Included, trial, promotional and purchased credits are tracked separately, and the soonest-expiring credits are used first. If narration fails or stops before it is delivered (because you cancel it, the plan changes, or the storyteller stops sharing or deletes their voice), the credits reserved for the parts not delivered are returned automatically, once. Credits used for narration already delivered are not refunded. Expired credits have no cash value and are not refunded unless the law requires it. When a plan ends, its monthly and trial credits end with it. Purchased credits you haven’t used stay recorded on your household’s account when your plan ends, including through the 30-day recovery window. When that window ends without a plan, or when you delete your account, any unused credits, including purchased credits, are removed and are not refunded unless the law where you live requires it. If you return within the recovery window, your purchased credits are still there. Your credit and payment history is kept as the law requires.",
      },
      {
        lead: "Refunds",
        text: "Readli’s refund terms are shown before you buy. You can ask for a refund of a credit pack within 14 days of buying it if none of its credits have been used, by contacting admin@readli.ai; after that, or once any of its credits are used, credits aren’t refunded unless the law where you live requires it or Readli approves it, and then only for the unused share of the price you actually paid. Subscription payments are not refundable once a paid period starts, including when you cancel or delete your account, except where the law requires it, for billing errors or duplicate charges, or as Readli otherwise approves. Unused credits are not refunded when a plan ends or an account is deleted. Readli starts an approved refund within five business days; your payment provider or bank may take longer to return the money.",
      },
      {
        lead: "Stories already prepared",
        text: "Narration Readli has finished and stored for your household stays playable for your children while your household has Readli Family or Readli Family Archive, the child is still approved for that storyteller, the storyteller hasn’t turned sharing off for your household, and the story hasn’t been removed because the law requires it. Keeping and playing prepared stories is separate from making new ones. If a storyteller stops sharing their voice with every family or deletes it, nothing new can be made in it, but stories already prepared in it keep playing. If a storyteller records again, new stories use the new recording and stories already prepared keep the voice version they were made with.",
      },
      {
        lead: "Readli Family Archive",
        text: "a lower-priced plan (shown at checkout, currently $6.99 a month) for households that have had Readli Family. It keeps the household’s stored stories, listening, kids profiles, family relationships and permissions, and the eligible recordings behind them. It does not include making new narration, monthly credits or narrator slots. Moving from Readli Family to the Archive deletes nothing; narration still being prepared stops and its undelivered credits are returned. Moving back to Readli Family restores new narration for storytellers whose authorization is still in force. Moving between Readli Family and the Archive follows “Changing plan” above, and a change takes effect only once Readli’s payment provider confirms it.",
      },
      {
        lead: "When paid access ends",
        text: "if your household’s plan, gift or sponsorship ends and you haven’t chosen the Archive, listening stops right away and Readli keeps your household’s stories, kids profiles, listening progress and permissions for 30 days (the recovery window). Restart Readli Family or choose the Archive within the window and everything comes back. Readli emails the household’s grown-ups when the window starts, with ten days left (Day 20) and with two days left (Day 28), each time with the actual deletion date, and confirms once the removal has happened. If your household still has no plan after the window, Readli removes what belongs to your household alone: its saved stories and files no other household with a plan needs, its kids profiles and their listening progress, its preferences, notifications and unaccepted invitations, and original recordings no other household needs and that aren’t kept under a contributor’s Voice Recording & AI Training Agreement. Readli doesn’t remove stories, files or recordings another eligible household needs, or payment, credit and other records it must keep by law.",
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
        text: "these are required when you set up Readli Voice. You can change your mind with three separate actions in Readli, and each is recorded:",
      },
      { lead: `A. ${VOICE_CHOICES.deleteRecordings.title}`, text: VOICE_CHOICES.deleteRecordings.terms },
      { lead: `B. ${VOICE_CHOICES.stopSharing.title}`, text: VOICE_CHOICES.stopSharing.terms },
      { lead: `C. ${VOICE_CHOICES.deleteVoice.title}`, text: VOICE_CHOICES.deleteVoice.terms },
      {
        text: "Stories already prepared in your voice stay with the families you shared it with, as section 9 describes. To have them removed as well, contact admin@readli.ai, and Readli will remove them where the law requires through a separate, recorded process.",
      },
      {
        lead: "AI training",
        text: "you can withdraw permission for AI training on its own. Readli then stops using your recordings to develop its technology or for licensing, and your story voice keeps working. Models or systems already trained may not be able to remove what they learned from a recording.",
      },
      {
        lead: "Deleting your account",
        text: "this includes action C and stops narration being prepared. Stories already delivered to other families keep playing there as section 9 describes, unless the law requires their removal. You can record a new voice later, which needs a new agreement.",
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
