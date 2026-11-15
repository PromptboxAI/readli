/**
 * "Your voice stays yours" (Kevin, 2026-11-15, from the Remento review). Each line matches what the code
 * and the Privacy Policy say today: sharing and per-child approval (lib/family/permissions.ts), stopping
 * a share removes the voice from that family straight away (help: stop-sharing), no training and no sale
 * (/parents/safety), voices only read library books, account deletion removes the voice at ElevenLabs
 * and every recording (lib/account/privacy.ts), voices are kept while the account exists, and a business
 * transfer can't sell voice models separately (Privacy Policy, sharing section). The "if Readli closes"
 * answer is a promise Kevin made on 2026-11-15. Change a line here only together with what backs it.
 */
export const VOICE_STAYS_YOURS = [
  {
    title: "You decide who hears it",
    body: "Share it only with the families you choose, and their parents pick which children hear it. Stop sharing any time and it stops playing for them straight away.",
  },
  {
    title: "Never sold, never used to train AI",
    body: "Readli never sells or licenses your voice, and never uses it or your recordings to train AI.",
  },
  {
    title: "It only reads storybooks",
    body: "Your voice reads the books in the Readli library and nothing else. Nobody can type in words for it to say.",
  },
  {
    title: "Delete it whenever you like",
    body: "Delete your account and Readli deletes your voice, every recording you made and every story read in your voice, straight away.",
  },
];

export interface VoiceFaq {
  id: string;
  q: string;
  a: string;
}

export const VOICE_FAQS: VoiceFaq[] = [
  {
    id: "if-we-cancel",
    q: "What happens to my voice if we cancel?",
    a: "Nothing is locked away or deleted. Your voice stays in your account and still belongs to you. Your kids stop hearing family stories when the plan ends, and your recorded voice is still there if you come back. If you'd rather it was gone, you can delete it at any time.",
  },
  {
    id: "what-if-readli-goes-away",
    q: "What if Readli goes away?",
    a: "If Readli is ever sold, the new owner has to keep our Privacy Policy and every permission your family set, and family voices can never be sold on their own. If Readli ever closes, we'll email every family before we do, then delete every voice and every recording.",
  },
  {
    id: "can-someone-else-use-it",
    q: "Can someone else use my voice?",
    a: "No. Everyone records their own voice and agrees to how it's used first. Only you can share it, a family's parents approve it for each child, and it's never made public.",
  },
];
