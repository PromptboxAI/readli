/**
 * Readli Privacy Policy, from Kevin's draft "Readli_Privacy_Policy_Readli_ai_LLC_DRAFT.docx" (2026-10-10).
 * Address and contact email come from Kevin's Terms draft; the remaining bracketed placeholders are highlighted on the page.
 * The draft's internal "Required publication details" checklist is intentionally not published.
 */

export type PolicyParagraph = { lead?: string; text: string };
export type PolicySection = { id: string; title: string; paragraphs: PolicyParagraph[] };

/** The draft says to set the real effective date when the policy is published. */
export const PRIVACY_EFFECTIVE_DATE = "October 10, 2026";
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
        text: "audio recordings made for a temporary demo or for voice enrollment, transcripts and speech samples, voice identifiers or models, generated narrations, permission settings, verification results, and records of consent. Voice data can be sensitive and may be biometric data under applicable law.",
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
        text: "We may analyze aggregated or appropriately de-identified performance information to improve reliability and usability. We do not use family voice recordings or child-profile information to target advertising. Any broader use of voice recordings to train a general-purpose AI model would require separate clear disclosure and, where applicable, separate consent; Readli does not claim that independent processors follow the same practices without contractual verification.",
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
        text: "Private family voices are not made public or offered for general discovery. Participation in any future public narrator program would require a separate application, explicit license, and distinct permissions. We do not sell family voice recordings or voice models as standalone assets.",
      },
      {
        text: "A cloned voice can generate new speech that the individual did not personally say. Family members should understand this distinction before recording and before authorizing others to use a voice.",
      },
    ],
  },
  {
    id: "anonymous-voice-demo",
    title: "4. Anonymous voice demo",
    paragraphs: [
      {
        text: "Visitors may be able to record a short voice sample and hear a story preview without creating an account. Before recording, the demo will display an express consent notice identifying speech-processing providers and explaining processing, access, retention, and deletion.",
      },
      {
        text: 'Demo recordings and temporary generated voice assets will be deleted on a defined short retention schedule of [VERIFIED PERIOD] unless the visitor creates an account and expressly chooses to save the voice, subject to technical copies, legally required retention, and processor deletion timelines. A displayed promise such as "deleted within 24 hours" will be used only after Readli verifies it is enforced across its own and provider systems.',
      },
      {
        text: "We may use short-lived tokens, IP-based abuse controls, and request limits to protect the public demo. We do not require visitors to create an account merely to hear an eligible introductory preview.",
      },
    ],
  },
  {
    id: "childrens-privacy-and-parental-control",
    title: "5. Children’s privacy and parental control",
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
        text: "Children’s face photographs, voice recordings, audio, persistent identifiers, and similar information receive particular care and are not required unless needed for an enabled, parent-approved feature. We do not intend to create or publish child voice clones in the initial family-voice program.",
      },
    ],
  },
  {
    id: "family-visibility-invitations-and-sharing",
    title: "6. Family visibility, invitations, and sharing",
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
    title: "7. Vendors and disclosures",
    paragraphs: [
      {
        text: "We disclose information to vetted providers when needed for the Services, including ElevenLabs for AI voice processing, hosting/storage, authentication, payments, delivery, analytics, customer support, and security providers as actually enabled. An accurate, current provider list and applicable processor agreements will be maintained [PROVIDER-LIST URL OR CONTACT METHOD].",
      },
      {
        text: "ElevenLabs independently publishes a privacy policy describing its practices, including potential model-improvement uses and available data-use settings. We will determine the settings and contractual safeguards available for Readli’s API integration, and explain any material consequences to users before launching voice enrollment.",
      },
      {
        text: "We may also disclose information with your direction; to protect rights, safety, and service integrity; to comply with law; or in a bona fide transaction involving the business, subject to applicable law and disclosed commitments. A business transaction does not authorize an unrelated sale of children’s personal information or private family voice models.",
      },
    ],
  },
  {
    id: "cookies-and-analytics",
    title: "8. Cookies and analytics",
    paragraphs: [
      {
        text: "We may use essential cookies or similar technology for login, security, playback preferences, and fraud prevention. Optional analytics or advertising tools, if deployed, will be disclosed in a cookie notice and configured to respect applicable consent requirements. We will not place behavioral advertising trackers in parent-managed child experiences without legal review and any legally required consent.",
      },
    ],
  },
  {
    id: "retention-and-deletion",
    title: "9. Retention and deletion",
    paragraphs: [
      {
        text: "We retain information only as long as reasonably necessary for the purposes described above, legal obligations, security, and dispute resolution. Retention periods vary by category and will be documented before launch: [DEMO RECORDINGS], [ACTIVE VOICES], [DELETED VOICES], [CHILD PROFILES], [ACCOUNT RECORDS], [BACKUPS], [SECURITY LOGS].",
      },
      {
        text: "Adults may request access, correction, consent withdrawal, family-permission changes, and account, child-profile, or enrolled-voice deletion through available controls or by contacting admin@readli.ai. We may verify identity or parental authority before acting. Deleting a Readli item may not immediately remove lawful backup copies or data retained by an independent processor; applicable timelines will be explained.",
      },
    ],
  },
  {
    id: "security-and-international-processing",
    title: "10. Security and international processing",
    paragraphs: [
      {
        text: "We use measures appropriate to the sensitivity of voice and children’s information, such as access restrictions, encrypted transmission, and logging of privileged actions, where implemented. No system can be guaranteed fully secure. Service providers may process data outside the user’s state or country, subject to applicable safeguards.",
      },
    ],
  },
  {
    id: "privacy-rights",
    title: "11. Privacy rights",
    paragraphs: [
      {
        text: "Depending on residence and the laws that apply, individuals may have rights to request access, correction, deletion, portability, consent withdrawal, or information about certain disclosures, and to appeal a privacy decision. Contact admin@readli.ai and we will respond as required by law. We will not discriminate against users for exercising applicable privacy rights.",
      },
    ],
  },
  {
    id: "changes-and-contact",
    title: "12. Changes and contact",
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
