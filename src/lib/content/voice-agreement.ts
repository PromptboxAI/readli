/**
 * Readli Voice Recording & AI Training Agreement, from Kevin's proposed voice-rights terms (2026-10-11).
 * The exact wording a contributor accepts is stored on their agreement
 * record, so bump VOICE_AGREEMENT_VERSION whenever a line here or a permission statement changes.
 */

import type { PolicySection } from "@/lib/content/privacy-policy";

export const VOICE_AGREEMENT_VERSION = "voice-agreement-2026-10-12.3";
export const VOICE_AGREEMENT_EFFECTIVE_DATE = "October 12, 2026";
export const VOICE_AGREEMENT_PATH = "/voice-agreement";

/**
 * The three rights are granted separately. Service and Readli development are part of the standard Readli
 * Voice agreement; licensing to other companies is a separate opt-in that starts off.
 */
export type VoicePermission = "service" | "readli_development" | "third_party_licensing";

export interface PermissionStatement {
  permission: VoicePermission;
  required: boolean;
  title: string;
  /** What the contributor ticks, verbatim. */
  statement: string;
}

export const ADULT_OWNER_STATEMENT = "I'm 18 or older, this is my own voice, and I'm the only person speaking.";

/** Kevin, 2026-10-12, decision 5: free contributors aren't paid, and the agreement says so expressly. */
export const COMPENSATION_STATEMENT =
  "I'm volunteering my voice. Readli doesn't pay me any fee, royalty, residual or share of revenue for my recordings or the rights I grant here.";

export const PERMISSION_STATEMENTS: readonly PermissionStatement[] = [
  {
    permission: "service",
    required: true,
    title: "Readli service",
    statement:
      "Readli can store my original recording and use it to make, remake and improve a private digital version of my voice that reads stories to the families I choose.",
  },
  {
    permission: "readli_development",
    required: true,
    title: "Readli technology",
    statement:
      "Readli can use my original recording to develop, train, test and improve Readli's own voice technology, including through providers working on Readli's behalf.",
  },
  {
    permission: "third_party_licensing",
    required: false,
    title: "Licensing to other companies (optional)",
    statement:
      "Optional, and separate from the rest of this Agreement: Readli may license my original recordings to independent AI companies to train and develop their own voice models, under written licenses that limit how they may be used and forbid impersonating me. I'm not paid for this. I can turn it off later for future licensing; licenses already granted continue on their terms.",
  },
] as const;

/** Lines the contributor must tick before the microphone starts, in order. */
export const REQUIRED_AGREEMENT_STATEMENTS: readonly string[] = [
  ADULT_OWNER_STATEMENT,
  ...PERMISSION_STATEMENTS.filter((p) => p.required).map((p) => p.statement),
  COMPENSATION_STATEMENT,
  "Families can only use my voice after I share it with them and their parents approve it for each child. I can stop sharing, replace or delete my voice at any time.",
];

export const THIRD_PARTY_LICENSING_STATEMENT = PERMISSION_STATEMENTS.find((p) => p.permission === "third_party_licensing")!.statement;

/**
 * The three voice actions (Kevin, 2026-10-12, answer 5), labelled the same in the app, this Agreement,
 * the Terms and the Privacy Policy. `terms` is the Agreement's wording; `notice` is what the app shows
 * before the grown-up confirms, and its version is stored with the request.
 */
export const VOICE_CHOICES = {
  deleteRecordings: {
    title: "Delete my original recordings",
    terms:
      "Readli stops using your stored original recordings at once and removes them from its active storage, normally within 30 days, subject to legal exceptions. Your story voice (the voice model already made at Readli's voice provider) keeps working for the families you share it with only while you keep sharing it, your Readli service permission stays in force, and the law and the provider's rules allow it; otherwise Readli retires it. Once your recordings are deleted, a retired story voice can't be re-made from them; to use Readli Voice again you record again.",
    notice:
      "Readli stops using your original recordings for anything new straight away, and your request to delete them from our storage is recorded. We'll show here when the deletion has finished; until then they're kept but not used. Your story voice keeps reading for the families you share it with while you keep sharing it. If you're not sharing it with anyone, it stops being used, and we'll tell you here when it has been removed from our voice provider. Stories already made stay with your families.",
  },
  stopSharing: {
    title: "Stop sharing my voice",
    terms:
      "This withdraws your authorization for new stories in your voice in every family at once. Stories still being prepared stop (unused credits go back to the family), and your voice model at Readli's voice provider is retired. Stories already prepared keep playing for the families you shared with, as section 9 describes. Your original recordings and this Agreement are kept, so you can allow new stories again later, when your voice model is re-made from your recording. Separately, you can turn sharing off for one family at a time; that family then stops hearing your voice, including stories already prepared for it.",
    notice:
      "From now on no family can have new stories made in your voice. Stories still being prepared stop, and unused credits go back to each family. Stories already made keep playing, and your recordings are kept, so you can allow new stories again later. Your voice model stays stored at our voice provider, unused, until it's removed there; we'll tell you here when that has happened.",
  },
  deleteVoice: {
    title: "Delete my voice entirely",
    terms:
      "This ends the Readli service and development rights for future use and is recorded as a withdrawal. No new narration is made in your voice for any family, its voice model at Readli's voice provider is deleted and never re-made, stories still being prepared stop, your original recordings are taken out of all development, training and licensing, and they are deleted from Readli's storage, normally within 30 days, subject to legal exceptions.",
    notice:
      "No new stories can be made in your voice, ever. Your voice model is deleted at our voice provider, anything still being prepared stops (unused credits go back to the family), and your original recordings are deleted from our storage, normally within 30 days. Stories already made stay with the families you shared your voice with. You can record a new voice whenever you like.",
  },
} as const;

/** Stored with each recording-deletion request: the notice the grown-up confirmed. */
export const VOICE_CHOICES_NOTICE_VERSION = "voice-choices-2026-10-21";

export const VOICE_AGREEMENT_INTRO: string[] = [
  'This Voice Recording & AI Training Agreement ("Agreement") applies when an adult creates and records a Readli Voice profile. It is part of the Readli Terms of Service, and the Privacy Policy explains how voice data is handled. Readli shows this Agreement and asks for your acceptance before the microphone starts.',
  "It covers only the original recordings you make with Readli. Narration generated from your voice is synthetic audio, not a recording of you.",
];

export const VOICE_AGREEMENT_SECTIONS: PolicySection[] = [
  {
    id: "who-can-record",
    title: "1. Who can record",
    paragraphs: [
      {
        text: "You must be at least 18 years old, or the age of majority where you live if higher, and you may record only your own voice, with no one else speaking. Children cannot create a Readli Voice profile or accept this Agreement, and Readli does not create voice clones of children.",
      },
    ],
  },
  {
    id: "authorization",
    title: "2. Voice recording, AI development and data rights",
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
    ],
  },
  {
    id: "three-rights",
    title: "3. The three rights, granted separately",
    paragraphs: [
      {
        lead: "Readli service rights",
        text: "store, clone, re-clone, improve and generate narrated stories using your original recording, for the families you choose to share your voice with. Required to use Readli Voice.",
      },
      {
        lead: "Readli technology development rights",
        text: "use your original recordings to develop, train, evaluate and improve Readli-owned voice-generation systems, including through third-party processors working on Readli’s behalf under contract. Required when you set up Readli Voice, subject to applicable law. You can withdraw it later without losing your story voice, as section 8 describes.",
      },
      {
        lead: "Independent commercial licensing rights",
        text: "license your eligible original recordings to independent AI companies for their own model development, training, evaluation and testing, with sublicensing only where the written license expressly allows it. This needs its own separate, affirmative authorization: accepting this Agreement or the Terms of Service is not enough. It is optional, off unless you specifically turn it on, and never a condition of using Readli. Readli includes a recording in a licensed dataset only while that authorization is recorded and still valid for the intended use. Each commercial license must define the approved uses, security obligations, how long the licensee may keep the recordings, any onward transfer or sublicensing, and a ban on using them to impersonate you. Licensing is offered only where the law allows it: Readli records where you are when you give or change this authorization and doesn’t offer it in places whose biometric privacy laws restrict it. Readli hasn’t started licensing recordings to other companies and will not do so before a separate launch decision.",
      },
      {
        text: "Readli records which of these rights you granted, for each recording, so that Readli and any successor know exactly what each recording may be used for. Each right lasts until you withdraw it as section 8 describes.",
      },
      {
        lead: "Authorized uses",
        text: "under the rights you grant, Readli may use your original recordings for Readli-owned AI model development; voice cloning and re-cloning; model training, evaluation, testing and improvement; and commercial development of voice-generation technology. With the separate licensing authorization only, Readli may also license eligible recordings to independent AI companies as described above. Readli may transfer recordings and the rights you granted in a business transaction as section 7 describes.",
      },
    ],
  },
  {
    id: "children",
    title: "4. Children’s voices and data",
    paragraphs: [
      {
        text: "Readli never includes children’s voices or children’s personal information in any dataset licensed to, or used by, a third party for its own model training. Anonymous guest demo recordings and narration generated by Readli’s voice provider are never included either. Child profile data is used only to run the parent-approved Readli Kids experience, as the Privacy Policy describes.",
      },
    ],
  },
  {
    id: "what-readli-keeps",
    title: "5. What Readli keeps with each recording",
    paragraphs: [
      {
        text: "To document your rights and keep recordings useful, Readli keeps your original audio together with its length, quality checks, language, the script you read (as its expected transcript), technical capture details such as format and device type, and the version of this Agreement and the permissions you granted. Readli also keeps a history of every change you make to those permissions, with timestamps, your account identity and your approximate location (state or country) at the time, along with your withdrawal and deletion requests, any license agreements that covered your recordings, and which licensed datasets included them and when that was disclosed.",
      },
    ],
  },
  {
    id: "ownership",
    title: "6. Ownership and compensation",
    paragraphs: [
      {
        text: "Readli owns its independently developed software, systems, proprietary models, and intellectual property, together with the rights you grant in your submitted recordings under this Agreement and any rights it lawfully acquires in generated content. Nothing in this agreement transfers ownership of your natural voice or personal identity as a whole: you keep your voice, your name and your likeness.",
      },
      {
        lead: "Compensation",
        text: "Readli Voice is free and voluntary. You aren’t paid for recording or for any right you grant under this Agreement, including Readli development and, if you turn it on, licensing to other companies: there are no recording fees, royalties, residuals or automatic revenue-sharing payments, even if Readli earns money from its technology or from licenses. Readli may offer separate paid recording or dataset programs in the future under different agreements; none is offered now, and joining one would need a new agreement.",
      },
    ],
  },
  {
    id: "business-transfers",
    title: "7. Business transfers",
    paragraphs: [
      {
        text: "Readli may transfer its business assets, intellectual property, contractual rights, and associated authorized data in connection with a merger, acquisition, restructuring, financing, or sale of the business, subject to applicable privacy and other legal obligations. Any recipient remains bound by the permissions recorded for each recording.",
      },
    ],
  },
  {
    id: "withdrawal",
    title: "8. Changing your mind",
    paragraphs: [
      {
        text: "You can change your mind at any time, in Readli Family under My voice and Account settings. Three separate actions are available, and each is recorded:",
      },
      {
        text: `A. ${VOICE_CHOICES.deleteRecordings.title}. ${VOICE_CHOICES.deleteRecordings.terms}`,
      },
      {
        text: `B. ${VOICE_CHOICES.stopSharing.title}. ${VOICE_CHOICES.stopSharing.terms}`,
      },
      {
        text: `C. ${VOICE_CHOICES.deleteVoice.title}. ${VOICE_CHOICES.deleteVoice.terms}`,
      },
      {
        text: "Separately, you can withdraw permission for AI training: Readli development and licensing of your recordings stop, and your story voice keeps working. You can also turn independent commercial licensing off on its own; that stops new licensing of your recordings, but cannot recall copies already licensed under your earlier authorization unless the license or law requires it. Models or systems already trained may not be able to remove what they learned from a recording.",
      },
      {
        text: "Deleting your account includes action C. Stories already delivered to other families keep playing there as section 9 describes, unless the law requires their removal. Recording again later needs a new agreement. In every case, stories already prepared are handled as section 9 describes, and legally required removals stay available. Contact admin@readli.ai for help or to exercise any legally required withdrawal, deletion or privacy right.",
      },
    ],
  },
  {
    id: "prepared-stories",
    title: "9. Stories already prepared",
    paragraphs: [
      {
        text: "This Agreement separates two things. Future narration rights let Readli make new narration in your voice and re-create your voice clone; they are paused while you stop sharing your voice (action B) and end when you delete your voice (action C). Retention and playback of narration already finished let the families you shared your voice with keep playing stories Readli completed for them before then, in the voice version each story was made with, for as long as their household has a Readli plan that includes those stories, unless you turn sharing off for that one family. Recording again replaces your voice for new stories only.",
      },
      {
        text: "If the law requires stories already prepared in your voice to be removed, Readli removes them for that voice or that book through a separate, recorded process. Contact admin@readli.ai to ask.",
      },
    ],
  },
  {
    id: "law-and-changes",
    title: "10. Applicable law and changes",
    paragraphs: [
      {
        text: "All rights and authorizations are subject to applicable law, platform policies, and legally required withdrawal, deletion, and privacy rights.",
      },
      {
        text: "If Readli changes this Agreement in a way that expands how your recordings can be used, it will ask for your agreement again before applying the new use to your recordings.",
      },
    ],
  },
];
