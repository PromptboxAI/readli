/**
 * Readli Voice Recording & AI Training Agreement, from Kevin's proposed voice-rights terms (2026-10-11).
 * Counsel must review before launch. The exact wording a contributor accepts is stored on their agreement
 * record, so bump VOICE_AGREEMENT_VERSION whenever a line here or a permission statement changes.
 */

import type { PolicySection } from "@/lib/content/privacy-policy";

export const VOICE_AGREEMENT_VERSION = "voice-agreement-2026-10-12.1";
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
      "Optional: Readli may license my original recording to other companies to train and develop their own AI models. I can turn this off later for future licensing.",
  },
] as const;

/** Lines the contributor must tick before the microphone starts, in order. */
export const REQUIRED_AGREEMENT_STATEMENTS: readonly string[] = [
  ADULT_OWNER_STATEMENT,
  ...PERMISSION_STATEMENTS.filter((p) => p.required).map((p) => p.statement),
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
      "Your original recordings stop being used now and are deleted from our storage, normally within 30 days. Your story voice keeps reading for the families you share it with while you keep sharing it; if you're not sharing it with anyone, it's retired now. Once retired it can't be re-made without recording again. Stories already made stay with your families.",
  },
  stopSharing: {
    title: "Stop sharing my voice",
    terms:
      "This withdraws your authorization for new stories in your voice in every family at once. Stories still being prepared stop (unused credits go back to the family), and your voice model at Readli's voice provider is retired because no valid use remains. Stories already prepared keep playing for the families you shared with, as section 9 describes. Your original recordings and this Agreement are kept, so you can allow new stories again later, when your voice model is re-made from your recording. Separately, you can turn sharing off for one family at a time; that family then stops hearing your voice, including stories already prepared for it.",
    notice:
      "No family can have new stories made in your voice. Stories being prepared stop and unused credits go back to each family. Your voice model is retired. Stories already made keep playing, and your recordings are kept, so you can allow new stories again later.",
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
export const VOICE_CHOICES_NOTICE_VERSION = "voice-choices-2026-10-12";

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
        text: "use your original recordings to develop, train, evaluate and improve Readli-owned voice-generation systems, including through third-party processors working on Readli’s behalf under contract. Required to use Readli Voice, subject to applicable law.",
      },
      {
        lead: "Independent commercial licensing rights",
        text: "license your original recordings to other companies for their own AI model development and training. This is optional, off unless you specifically turn it on, and is never a condition of using Readli. Any licensing of identifiable voice recordings to third parties for their independent model training or commercial development will be subject to a separate, clearly disclosed authorization where required.",
      },
      {
        text: "Readli records which of these rights you granted, for each recording, so that Readli and any successor know exactly what each recording may be used for.",
      },
    ],
  },
  {
    id: "children",
    title: "4. Children’s voices and data",
    paragraphs: [
      {
        text: "Readli never includes children’s voices or children’s personal information in any dataset licensed to, or used by, a third party for its own model training. Child profile data is used only to run the parent-approved Readli Kids experience, as the Privacy Policy describes.",
      },
    ],
  },
  {
    id: "what-readli-keeps",
    title: "5. What Readli keeps with each recording",
    paragraphs: [
      {
        text: "To document your rights and keep recordings useful, Readli keeps your original audio together with its length, quality checks, language, the script you read (as its expected transcript), technical capture details such as format and device type, and the version of this Agreement and the permissions you granted. Readli also keeps a history of every change you make to those permissions, with timestamps and your account identity.",
      },
    ],
  },
  {
    id: "ownership",
    title: "6. Ownership",
    paragraphs: [
      {
        text: "Readli owns its independently developed software, systems, proprietary models, and intellectual property, together with any rights it lawfully acquires in recordings and generated content. Nothing in this agreement transfers ownership of your natural voice or personal identity as a whole.",
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
        text: "Deleting your account includes action C, and keeps stories already delivered to other families only as far as this Agreement and the law allow. Recording again later needs a new agreement. In every case, stories already prepared are handled as section 9 describes, and legally required removals stay available. Contact admin@readli.ai for help or to exercise any legally required withdrawal, deletion or privacy right.",
      },
    ],
  },
  {
    id: "prepared-stories",
    title: "9. Stories already prepared",
    paragraphs: [
      {
        text: "This Agreement separates two things. Future narration rights let Readli make new narration in your voice and re-create your voice clone; they end when you delete your voice. Retention and playback of narration already finished let the families you shared your voice with keep playing stories Readli completed for them before then, in the voice version each story was made with, for as long as their household has a Readli plan that includes those stories. Recording again replaces your voice for new stories only.",
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
