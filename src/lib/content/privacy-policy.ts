/**
 * Readli Privacy Policy. Started from Kevin's draft "Readli_Privacy_Policy_Readli_ai_LLC_DRAFT.docx"
 * (2026-10-10) and finalized for publication on 2026-10-23 to describe what the live service does. Every
 * retention period here is enforced in code; the demo's 24 hours depends on the hourly clean-up (PR #133).
 * Kevin's later decisions on training rights, optional licensing and keeping finished stories after a
 * voice is withdrawn are not described until the code and Voice Agreement that carry them ship (PR #53).
 * Change this text together with the behaviour it describes.
 */

export type PolicyParagraph = { lead?: string; text: string };
export type PolicySection = { id: string; title: string; paragraphs: PolicyParagraph[] };

export const PRIVACY_EFFECTIVE_DATE = "October 24, 2026";

export const PRIVACY_INTRO: string[] = [
  'Readli ("Readli," "we," "our," or "us"), operated by Readli.ai LLC at 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790, provides family storytelling, children’s reading, and optional AI-generated narration in voices that participating adults choose to record and share. This Privacy Policy describes how we collect, use, disclose, retain, and protect information when you visit readli.ai, try our voice demo, or use Readli Family, Readli Kids, Readli Voice, and related features (together, the "Services").',
  "Readli Kids is used only through parent- or guardian-managed profiles. Adults control invitations and voice permissions. Voice data can be sensitive and may be biometric data under the laws where you live, so this policy says plainly what happens to it.",
];

export const PRIVACY_SECTIONS: PolicySection[] = [
  {
    id: "information-we-collect",
    title: "1. Information we collect",
    paragraphs: [
      {
        lead: "Account and contact data",
        text: "adults’ name, email address, sign-in information (by email link or, if you choose, Google sign-in, from which we receive your name, email address and profile picture), profile photo if you add one, preferences, support requests, and records of what you agreed to and when.",
      },
      {
        lead: "Family connections and child profiles",
        text: "household and family connections, relationship labels and nicknames, invitations (including the name and email address of the person you invite), and for each child profile a nickname, an icon and an age band. We ask for nicknames rather than children’s full names, and we do not ask for children’s photos, voices, or birth dates.",
      },
      {
        lead: "Voice and audio",
        text: "recordings adults make for the voice demo or for their account voice, recording details (such as length and device type), the voice model our voice provider makes from a recording, voice previews, narration generated in a voice, sharing and approval settings, and consent records.",
      },
      {
        lead: "Reading and activity data",
        text: "books chosen, listening progress, which voice a story was played in, favorites, story requests, narration requests, and Kids Mode devices (a device name, the active child profile, when it was last used, and a hashed household PIN).",
      },
      {
        lead: "Device and website data",
        text: "IP address, browser and device information, cookies needed for sign-in and security, diagnostics, anti-abuse signals, and first-party usage events recorded by Readli itself.",
      },
      {
        lead: "Payment data",
        text: "plan, billing status, transaction records, and payment identifiers from Stripe. Card details are entered on Stripe’s checkout and are not stored by Readli.",
      },
    ],
  },
  {
    id: "how-we-use-information",
    title: "2. How we use information",
    paragraphs: [
      {
        text: "We use information to create and secure accounts, run households and invitations, check consent and voice permissions, make voice models and generate narration, provide playback and read-along text, save listening progress, process payments, send service emails (such as sign-in links and invitations), answer support requests, prevent fraud and impersonation, and comply with the law.",
      },
      {
        text: "We use aggregated usage information to improve reliability and usability. We do not use family voice recordings or child-profile information for advertising.",
      },
      {
        lead: "No AI training, licensing or sale",
        text: "Readli does not use voice recordings, voice models, or children’s information to train or develop AI models, and does not license, sell, or share recordings or voice models with other companies for their own use. If Readli ever wants to use recordings for AI development or to license them, it will explain the change and ask for each person’s separate, express permission first.",
      },
    ],
  },
  {
    id: "voice-recording-and-consent",
    title: "3. Voice recording and consent",
    paragraphs: [
      {
        text: "Recording a voice is optional. Before Readli makes a voice from an account recording, the adult confirms that it is their own voice and that they are the only person recording, that Readli may make a private digital version of their voice to read stories, and that families can use it only after the adult shares it and the family’s parents approve it for each child. Readli stores that confirmation with the wording version and time.",
      },
      {
        text: "To make a voice, Readli sends the recording to ElevenLabs, our voice provider, which creates a voice model that Readli uses to generate narration. Only an individual’s own voice may be recorded. Invitations do not authorize anyone to record or clone another person’s voice.",
      },
      {
        text: "A cloned voice can say words the person never spoke. Family members should understand this before recording and before sharing a voice.",
      },
    ],
  },
  {
    id: "voice-demo",
    title: "4. Voice demo",
    paragraphs: [
      {
        text: "Visitors can record a short sample and hear a story preview without an account. Before recording, the demo shows a consent notice naming ElevenLabs and explaining processing and deletion.",
      },
      {
        text: "The demo recording, the demo voice model at ElevenLabs, and generated demo audio are deleted automatically within 24 hours of recording. Readli runs the deletion every hour and retries any step that fails on the next run. If you create an account on the same device before then and choose to use the take as your account voice, after agreeing to the account voice terms in section 3, Readli copies the recording into your account; the demo copy is still deleted on schedule. Short-lived tokens, IP-based limits, and request limits protect the demo.",
      },
    ],
  },
  {
    id: "childrens-privacy-and-parental-control",
    title: "5. Children’s privacy and parental control",
    paragraphs: [
      {
        text: "Children cannot create accounts, record a voice for cloning, or grant voice-sharing permission. Child-facing features run under a profile a parent or guardian manages, and the parent or guardian chooses which storytellers, among those who have shared their voice with the household, each child can hear. A child cannot change these approvals. We collect only a nickname, an icon, an age band, and the child’s listening activity (books, progress, favorites, and story requests).",
      },
      {
        text: "Where the Children’s Online Privacy Protection Act (COPPA) applies, we will provide required notices and obtain verifiable parental consent before collecting a child’s personal information unless a lawful exception applies. Parents can review a child’s information, delete a child profile, and stop further collection by contacting admin@readli.ai or using family settings.",
      },
      {
        text: "We do not sell children’s personal information, do not show advertising to children, and do not use third-party advertising or tracking in Readli Kids.",
      },
    ],
  },
  {
    id: "family-visibility-invitations-and-sharing",
    title: "6. Family visibility, invitations, and sharing",
    paragraphs: [
      {
        text: "An invitation shows the invited person the inviting adult’s name and household. Connected family members may see each other’s names or nicknames, relationship labels, profile photos, and whether a voice is available, depending on settings.",
      },
      {
        text: "All family voices are private by default. Two independent approvals are needed before a voice appears for a child: the voice owner shares the voice with the household, and a parent or guardian approves that storyteller for that child. Each newly shared voice starts off for every child. Either approval can be withdrawn at any time. When either is withdrawn, or the household’s plan ends, stories already prepared in that voice stop playing there; they stay stored and play again if the approvals and plan are restored, unless they are deleted as section 9 describes.",
      },
    ],
  },
  {
    id: "service-providers-and-disclosures",
    title: "7. Service providers and disclosures",
    paragraphs: [
      {
        text: "We share information only with providers that process it on Readli’s behalf to run the Services:",
      },
      { lead: "ElevenLabs", text: "makes voice models from recordings and generates narration." },
      { lead: "Supabase", text: "database, file storage, and sign-in." },
      { lead: "Vercel", text: "website hosting and scheduled jobs." },
      { lead: "Stripe", text: "payments and billing." },
      { lead: "Resend", text: "invitation and other service emails." },
      { lead: "Google", text: "sign-in, only if you choose Google sign-in." },
      {
        lead: "Loom",
        text: "hosts a recording-tips video shown on the recording screen; Loom may set its own cookies when the video plays.",
      },
      {
        text: "These providers have their own privacy policies, which govern their own handling of the data they receive. ElevenLabs offers an account setting that lets it use customer data to improve its models; Readli has turned that setting off for its account.",
      },
      {
        text: "We may also disclose information at your direction; to protect rights, safety, and the Services; to comply with law; or in a merger, acquisition, or sale of the business, in which case the recipient remains bound by this policy and the permissions people gave. A business transfer does not authorize a separate sale of children’s personal information or family voice models.",
      },
    ],
  },
  {
    id: "cookies-and-analytics",
    title: "8. Cookies and analytics",
    paragraphs: [
      {
        text: "We use essential cookies for sign-in, security, Kids Mode devices, and the demo. Readli records its own usage events in its own database and does not use third-party analytics or advertising trackers. Fonts are served from Readli’s own site. Embedded content, such as the Loom video above, may set its provider’s cookies when you play it.",
      },
    ],
  },
  {
    id: "retention-and-deletion",
    title: "9. Retention and deletion",
    paragraphs: [
      { lead: "Voice demo", text: "deleted within 24 hours of recording, as section 4 describes." },
      {
        lead: "A new account recording you don’t keep",
        text: "if you record a new take and neither keep nor discard it, the recording and the test voice made from it are deleted automatically within 48 hours.",
      },
      {
        lead: "Your account voice",
        text: "kept while your account exists, so families you share it with can keep listening. When you keep a new recording, the earlier voice model is deleted at ElevenLabs. In-app voice deletion is temporarily unavailable while Readli improves it; to delete your voice now, email admin@readli.ai, and we will tell you what was deleted.",
      },
      {
        lead: "Deleting your account",
        text: "you can delete your account in account settings. Deletion is immediate: Readli deletes your voice model at ElevenLabs, your recordings and voice previews, narration generated in your voice for any household, your photos, households and child profiles that belong to you alone, and then your account and the data linked to it.",
      },
      {
        lead: "Child profiles",
        text: "kept until a parent or guardian deletes the profile or the household’s account is deleted. A Kids Mode device not used for 90 days loses access.",
      },
      {
        lead: "Records we must keep",
        text: "payment, tax and refund records, consent records, and security records are kept as long as the law requires or as needed to resolve disputes, even after deletion.",
      },
      {
        lead: "Backups, logs and providers",
        text: "deleted data can remain for a limited time in rolling database backups and service logs, which expire on our providers’ schedules and are not used to restore deleted data except to recover from a system failure. Providers may keep data for their own legal obligations.",
      },
      {
        text: "Adults may request access, correction, consent withdrawal, or deletion through the controls in Readli or by emailing admin@readli.ai. We may verify identity or parental authority before acting.",
      },
    ],
  },
  {
    id: "security-and-international-processing",
    title: "10. Security and international processing",
    paragraphs: [
      {
        text: "We protect voice and children’s information with access restrictions, encrypted connections, private storage with short-lived playback links, encrypted provider references, and logging of administrative actions. No system can be guaranteed fully secure. Our providers may process data in the United States and other countries.",
      },
    ],
  },
  {
    id: "privacy-rights",
    title: "11. Privacy rights",
    paragraphs: [
      {
        text: "Depending on where you live, you may have rights to access, correct, delete, or port your information, to withdraw consent, to learn about certain disclosures, and to appeal a privacy decision. Laws on biometric and voice data in some states (such as Illinois, Texas, and Washington) give additional rights, which Readli honors. Contact admin@readli.ai and we will respond as the law requires. We will not discriminate against you for exercising your rights.",
      },
    ],
  },
  {
    id: "changes-and-contact",
    title: "12. Changes and contact",
    paragraphs: [
      {
        text: "We will post updated versions with a new effective date, and give additional notice or ask for renewed consent where the law requires, especially for changes involving children’s information, family voice access, or how voice recordings are used.",
      },
      {
        text: "Privacy questions and parental requests: admin@readli.ai. Readli.ai LLC, 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790. https://readli.ai.",
      },
    ],
  },
];
