/**
 * Readli Voice Recording & AI Training Agreement, from Kevin's proposed voice-rights terms (2026-10-11).
 * Counsel must review before launch. The exact wording a contributor accepts is stored on their agreement
 * record, so bump VOICE_AGREEMENT_VERSION whenever a line here or a permission statement changes.
 */

import type { PolicySection } from "@/lib/content/privacy-policy";

export const VOICE_AGREEMENT_VERSION = "voice-agreement-2026-10-11.2";
export const VOICE_AGREEMENT_EFFECTIVE_DATE = "October 11, 2026";
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
        text: "You can turn independent commercial licensing off at any time; that stops new licensing of your recordings, but cannot recall copies already licensed under your earlier authorization unless the license or law requires it. You can withdraw from Readli Voice by deleting your voice (in Readli Family, under My voice) or your account. Deleting your voice ends the service and development rights for future use and is recorded as a withdrawal: no new narration is made in your voice, it is never re-cloned, its clone at Readli’s voice provider is deleted, and your original recordings are taken out of all future development, training and licensing. Stories already prepared in it stay with the families you shared it with, as section 9 describes. Deleting your account also deletes your original recordings and the narration made in your voice, as the Privacy Policy describes. Recording again later needs a new agreement. Models or systems already trained may not be able to remove what they learned from a recording. Contact admin@readli.ai for help or to exercise any legally required withdrawal, deletion or privacy right.",
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
