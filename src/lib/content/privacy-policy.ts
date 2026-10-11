/**
 * Readli Privacy Policy, from Kevin's draft "Readli_Privacy_Policy_Readli_ai_LLC_DRAFT.docx" (2026-10-10).
 * Address and contact email come from Kevin's Terms draft; the remaining bracketed placeholders are highlighted on the page.
 * The draft's internal "Required publication details" checklist is intentionally not published.
 * 2026-10-11: voice-rights amendment (Kevin): what voice data is kept, why, who receives it, model training,
 * retention and how to exercise rights. New section 4; later sections renumbered.
 */

export type PolicyParagraph = { lead?: string; text: string };
export type PolicySection = { id: string; title: string; paragraphs: PolicyParagraph[] };

/** The draft says to set the real effective date when the policy is published. */
export const PRIVACY_EFFECTIVE_DATE = "October 11, 2026";
export const PRIVACY_IS_DRAFT = true;

export const PRIVACY_INTRO: string[] = [
  'Readli ("Readli," "we," "our," or "us"), operated by Readli.ai LLC at 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790, provides family storytelling, children’s reading experiences, and optional AI-generated narration using voices volunteered by participating adults. This Privacy Policy describes how we collect, use, disclose, retain, and protect information when you visit readli.ai, try our voice demo, or use Readli Family, Readli Kids, and related features (together, the "Services").',
  "Our goal is simple: private family storytelling with meaningful control over the voices and information people share. Readli Kids is designed for use through parent- or guardian-managed profiles. Adults control invitations and voice permissions. Public narrator participation, if offered, uses a separate opt-in program.",
];

export const PRIVACY_SECTIONS: PolicySection[] = [
  {
    id: "information-we-collect",
    title: "1. Information we collect",
    paragraphs: [
      {
        lead: "Account and contact data",
        text: "adults’ name, email, authentication information, account preferences, support requests, and consent records. If sign-in providers are enabled, we receive the information you authorize them to share.",
      },
      {
        lead: "Family connections and child profiles",
        text: "names or nicknames, profile avatars/photos, relationship labels, invitation/contact information, parental authorization, age range where needed, access permissions, and family-circle membership. We recommend nicknames rather than children’s full legal names.",
      },
      {
        lead: "Voice and audio",
        text: "raw audio recordings made for a temporary demo or for voice enrollment; recording details such as length, quality checks, language, the script read (its expected transcript), format and device type; voice characteristics, embeddings, identifiers or models derived from a recording; generated narrations; permission settings, verification results, and records of consent, including the agreement version, the permissions granted, when, and any later changes. Voice data can be sensitive and may be biometric data under applicable law.",
      },
      {
        lead: "Reading and activity data",
        text: "books selected, playback positions, narrator changes, bookmarks, favorites, session activity, generated audio requests, and technical troubleshooting logs.",
      },
      {
        lead: "Device and website data",
        text: "IP address, browser and device characteristics, approximate location inferred from IP, cookie identifiers where used, diagnostics, anti-abuse signals, and information needed to protect the Services.",
      },
      {
        lead: "Payment data",
        text: "subscription tier, billing and transaction status, and limited payment identifiers. Full card details are normally processed by an independent payment provider rather than Readli.",
      },
    ],
  },
  {
    id: "how-we-use-information",
    title: "2. How we use information",
    paragraphs: [
      {
        text: "We use information to create and secure accounts, operate family circles, verify consent and voice authorization, generate narrated audio, provide book playback and read-along functions, save listening progress, answer support requests, prevent fraud or impersonation, administer purchases, and comply with legal obligations.",
      },
      {
        text: "We may analyze aggregated or appropriately de-identified performance information to improve reliability and usability. We do not use family voice recordings or child-profile information to target advertising. Adult contributors’ original recordings are also used to develop Readli’s own voice technology, and are licensed to other companies only with the contributor’s separate opt-in, as section 4 explains. Readli does not claim that independent processors follow the same practices without contractual verification.",
      },
    ],
  },
  {
    id: "voice-cloning-and-informed-consent",
    title: "3. Voice cloning and informed consent",
    paragraphs: [
      {
        text: "Voice cloning is optional. Adults who enroll a voice should receive a clear description of what is recorded, the use of ElevenLabs or other identified speech processors, who can access the synthesized narration, relevant retention practices, and how to revoke consent or delete a voice.",
      },
      {
        text: "Only an individual’s own voice may be submitted for cloning through ordinary self-service enrollment, unless a separately reviewed and lawful authorization process expressly permits otherwise. Invitations do not authorize anyone to upload or clone another person’s voice. A voice owner must affirmatively approve permitted listeners or family circles.",
      },
      {
        text: "Private family voices are not made public or offered for general discovery. Participation in any future public narrator program would require a separate application, explicit license, and distinct permissions. We do not sell or license family voice recordings or voice models to other companies unless the adult contributor has separately opted in to independent commercial licensing, and never children’s voices or data.",
      },
      {
        text: "A cloned voice can generate new speech that the individual did not personally say. Family members should understand this distinction before recording and before authorizing others to use a voice.",
      },
    ],
  },
  {
    id: "voice-data-training-and-licensing",
    title: "4. Voice data: what we keep, why, and who receives it",
    paragraphs: [
      {
        text: "Adults who record a Readli Voice accept the Voice Recording & AI Training Agreement (https://readli.ai/voice-agreement) before the microphone starts. Readli records the agreement version, each permission granted, the time, the contributor’s account, and every later change, for each contributor and each recording.",
      },
      {
        lead: "Raw audio",
        text: "the original recording, kept privately in Readli’s storage with its recording details. Used to create, re-create, restore and improve the contributor’s voice, and to develop and test Readli’s own voice technology. Kept while the voice or account exists; deleted when the contributor deletes their voice or account, subject to [DELETED VOICES] and [BACKUPS] timelines.",
      },
      {
        lead: "Voice characteristics and models",
        text: "voice models, embeddings or identifiers derived from a recording by Readli or its speech provider. Used only to generate narration for families the owner has shared with, and kept until the voice is replaced or deleted. Provider identifiers are stored encrypted and never sent to browsers.",
      },
      {
        lead: "Generated narration",
        text: "synthetic audio Readli generates and stores so families can listen again (a household’s Archive). Kept while the voice stays shared and approved and the plan allows, and deleted when the owner deletes their voice.",
      },
      {
        lead: "Account relationships and child profile data",
        text: "family membership, invitations, sharing and per-child approvals, and child nicknames, age bands, favourites and reading places. Used only to run the family and Readli Kids experience; never used for model training and never shared for third-party training.",
      },
      {
        lead: "Who receives it",
        text: "ElevenLabs receives recordings to create voices and receives story text to generate narration. Hosting and storage providers (Supabase and Vercel) store and serve data. Other technology providers or contractors may process recordings on Readli’s behalf to develop Readli’s own technology, under contract. Other companies receive an adult contributor’s original recordings only if that contributor opted in to independent commercial licensing, and never children’s voices or data.",
      },
      {
        lead: "Model training",
        text: "original recordings from adult contributors may be used to train and evaluate Readli-owned voice systems. They may be used to train another company’s models only with the contributor’s separate, specific opt-in, which is off by default. Guest demo recordings, children’s voices and children’s personal information are never used for training.",
      },
      {
        lead: "Your choices",
        text: "you can turn independent commercial licensing off at any time, stop sharing a voice, or delete your voice or account. Deleting your voice removes it from every family, deletes your original recordings and the narration made in it, and is recorded as a withdrawal that ends future development and licensing use; models already trained may not be able to remove what they learned. Use the controls in Readli or contact admin@readli.ai to exercise these or any other privacy rights described in section 12.",
      },
    ],
  },
  {
    id: "anonymous-voice-demo",
    title: "5. Anonymous voice demo",
    paragraphs: [
      {
        text: "Visitors may be able to record a short voice sample and hear a story preview without creating an account. Before recording, the demo will display an express consent notice identifying speech-processing providers and explaining processing, access, retention, and deletion.",
      },
      {
        text: 'Demo recordings and temporary generated voice assets will be deleted on a defined short retention schedule of [VERIFIED PERIOD] unless the visitor creates an account and expressly chooses to save the voice, subject to technical copies, legally required retention, and processor deletion timelines. A displayed promise such as "deleted within 24 hours" will be used only after Readli verifies it is enforced across its own and provider systems.',
      },
      {
        text: "Demo recordings are never used to develop Readli technology or licensed to anyone. We may use short-lived tokens, IP-based abuse controls, and request limits to protect the public demo. We do not require visitors to create an account merely to hear an eligible introductory preview.",
      },
    ],
  },
  {
    id: "childrens-privacy-and-parental-control",
    title: "6. Children’s privacy and parental control",
    paragraphs: [
      {
        text: "Children under 13 may not independently register an adult account, upload a voice for cloning, or grant voice-sharing permission. Child-facing features operate under a parent- or legal-guardian-managed profile. The parent or guardian manages which voice owners, among those who have separately consented to sharing, can appear as narrators for each individual child. A child cannot change these approvals. We aim to collect the minimum child information needed for the service.",
      },
      {
        text: "Where the Children’s Online Privacy Protection Act (COPPA) applies, we will provide required notices and obtain verifiable parental consent before collecting, using, or disclosing a child’s personal information unless a lawful exception applies. We will provide parents means to review, delete, and stop further collection of a child’s information.",
      },
      {
        text: "We do not sell children’s personal information or serve behavioral advertising targeted to child profiles. We will not enable third-party advertising or tracking involving children unless fully evaluated against applicable law and any required separate parental consent is obtained. Necessary service providers may process limited data to operate the approved Service.",
      },
      {
        text: "Children’s face photographs, voice recordings, audio, persistent identifiers, and similar information receive particular care and are not required unless needed for an enabled, parent-approved feature. We do not create or publish child voice clones. Children’s voices and personal information are never included in a third-party training dataset, by default or otherwise. COPPA limits how a child’s voice recording may be collected and kept; where a feature ever records a child, it will use the recording only for that request and delete it promptly, as COPPA requires.",
      },
    ],
  },
  {
    id: "family-visibility-invitations-and-sharing",
    title: "7. Family visibility, invitations, and sharing",
    paragraphs: [
      {
        text: "A family invitation can disclose the inviting adult’s display name and family-circle context to the invited recipient. Connected members may see approved avatar, name/nickname, relationship, and availability indicators, based on settings.",
      },
      {
        text: "All family voices are private by default. Joining a family circle or recording a voice does not grant another person or child permission to use it. Two independent approvals are required before a family voice appears in a child’s book or narrator selector: (1) the voice owner must expressly authorize the relevant household or recipient to use the voice, and (2) the child’s parent or authorized guardian must approve that specific voice for the child’s individual Readli Kids profile. Each newly shared voice starts disabled for every child. Both approvals can be withdrawn independently. Removing either approval removes the voice from the child’s available narrators and blocks further unauthorized generation or access to previously generated narration, subject to secure cache invalidation and applicable deletion requirements.",
      },
    ],
  },
  {
    id: "vendors-and-disclosures",
    title: "8. Vendors and disclosures",
    paragraphs: [
      {
        text: "We disclose information to vetted providers when needed for the Services, including ElevenLabs for AI voice processing, hosting/storage, authentication, payments, delivery, analytics, customer support, and security providers as actually enabled. An accurate, current provider list and applicable processor agreements will be maintained [PROVIDER-LIST URL OR CONTACT METHOD].",
      },
      {
        text: "ElevenLabs independently publishes a privacy policy describing its practices, including potential model-improvement uses and available data-use settings. We will determine the settings and contractual safeguards available for Readli’s API integration, and explain any material consequences to users before launching voice enrollment.",
      },
      {
        text: "We may also disclose information with your direction; to protect rights, safety, and service integrity; to comply with law; or in a bona fide transaction involving the business, subject to applicable law and disclosed commitments. In a merger, acquisition, restructuring, financing or sale, voice recordings transfer together with the permissions recorded for each contributor, and the recipient remains bound by them. A business transaction does not authorize an unrelated sale of children’s personal information or private family voice models.",
      },
    ],
  },
  {
    id: "cookies-and-analytics",
    title: "9. Cookies and analytics",
    paragraphs: [
      {
        text: "We may use essential cookies or similar technology for login, security, playback preferences, and fraud prevention. Optional analytics or advertising tools, if deployed, will be disclosed in a cookie notice and configured to respect applicable consent requirements. We will not place behavioral advertising trackers in parent-managed child experiences without legal review and any legally required consent.",
      },
    ],
  },
  {
    id: "retention-and-deletion",
    title: "10. Retention and deletion",
    paragraphs: [
      {
        text: "We retain information only as long as reasonably necessary for the purposes described above, legal obligations, security, and dispute resolution. Retention periods vary by category and will be documented before launch: [DEMO RECORDINGS], [ACTIVE VOICES], [DELETED VOICES], [CHILD PROFILES], [ACCOUNT RECORDS], [BACKUPS], [SECURITY LOGS]. Original voice recordings are kept while the voice or account exists so the voice can be restored or re-created. Records of what a contributor agreed to are kept as long as needed to show which uses were authorized.",
      },
      {
        text: "Adults may request access, correction, consent withdrawal, family-permission changes, and account, child-profile, or enrolled-voice deletion through available controls or by contacting admin@readli.ai. We may verify identity or parental authority before acting. Deleting a Readli item may not immediately remove lawful backup copies or data retained by an independent processor; applicable timelines will be explained.",
      },
    ],
  },
  {
    id: "security-and-international-processing",
    title: "11. Security and international processing",
    paragraphs: [
      {
        text: "We use measures appropriate to the sensitivity of voice and children’s information, such as access restrictions, encrypted transmission, and logging of privileged actions, where implemented. No system can be guaranteed fully secure. Service providers may process data outside the user’s state or country, subject to applicable safeguards.",
      },
    ],
  },
  {
    id: "privacy-rights",
    title: "12. Privacy rights",
    paragraphs: [
      {
        text: "Depending on residence and the laws that apply, individuals may have rights to request access, correction, deletion, portability, consent withdrawal, or information about certain disclosures, and to appeal a privacy decision. Contact admin@readli.ai and we will respond as required by law. We will not discriminate against users for exercising applicable privacy rights.",
      },
    ],
  },
  {
    id: "changes-and-contact",
    title: "13. Changes and contact",
    paragraphs: [
      {
        text: "We will post updated versions with an effective date and provide additional notice or obtain renewed consent if required for material changes, especially changes involving children’s information, family voice access, or voice processing.",
      },
      {
        text: "Privacy inquiries and parental requests: admin@readli.ai. Service support: admin@readli.ai. Legal operator: Readli.ai LLC, 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790. Website: https://readli.ai.",
      },
    ],
  },
];
