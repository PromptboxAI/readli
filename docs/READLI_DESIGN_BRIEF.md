# Readli Family — UI/UX Design Brief v1.0
**Date:** 2026-10-09  
**Audience:** Claude Code, frontend engineer, brand designer  
**Status:** Build-ready visual direction; original design assets still need production

## 1. Creative North Star
Readli is a joyous digital storybook and family voice keepsake, **not an AI dashboard**. Parents should see a warm, legitimate family product; children should see an imaginative, easy-to-navigate reading world. The site should feel alive without sacrificing clarity, loading speed, or accessibility.

**Primary marketing message:** “Their favorite stories. Read by their favorite people.”  
**Brand line:** “Every Book. Every Voice.”  
**Demo CTA:** “Hear a story in your voice — free”  
**Supporting CTA:** “Browse storybooks”  
**Family invitation CTA:** “Invite Grandma or Grandpa to read”  
**Do not use:** synthetic robots, neon AI gradients, overwhelming animations, dark enterprise dashboards, invented testimonials, inappropriate 'forever guaranteed' claims, copied Sago Mini / Lingokids IP.

### Visual references — study design principles only
- Sago Mini 2016 concept: https://2016.deuxhuithuit.com/en/project/sago-mini/ — expressive animated world, engaging discovery, hero character journeys.
- Lingokids: https://lingokids.com/ — bright polished illustration, oversized clear navigation, kid-facing card interactions.
- Sago Mini: https://sagomini.com/ — soft but character-rich visual storytelling.
- Never copy names, characters, illustrations, custom lettering, exact components, layouts or source code from references.

## 2. Brand system (design tokens: starting values, adjustable after review)
- Background warm ivory `#FFF9ED`; near-white surface `#FFFEF9`; primary ink `#283548`.
- Coral `#FF7967`; sunshine `#FFCE58`; sky `#7BC7F3`; mint `#9CE2BC`; lavender `#CBB7F5`; navy `#283548`.
- Feature areas should use broad playful color fields rather than dozens of detached rounded AI-style cards.
- Typeface pairing: licensed high-character friendly display face with a readable sans-serif UI (candidate Google fonts: Fredoka for display, Nunito Sans for UI; confirm licenses). For long read-along text use an accessible serif or highly legible sans; respect system text scaling.
- Buttons: oversized rounded pill or chunky illustrated tabs; minimum 44 x 44 CSS px targets, preferably 48+.
- Corners: 20–32px for panels, irregular but consistent illustration framing; avoid making every section identical.
- Illustration style: original 2D vector + subtle textured shading. Real family photography in trust/emotion sections, with documented model releases.
- Motion: mascot blink, gentle book bounce, page flip, cloud drift. Respect reduced-motion preference. Avoid autoplay sound.
- Mobile has fully functional recording, playback, selfie capture, guest consent and voice selection.

## 3. Mascot and logo exploration
**Preferred working concept: Readi, the 'R-book buddy'** — an original rounded open-book form in which the fold/negative space hints at lowercase `r`, with a face and small listening-shaped page corners. Body should be readable at 24px favicon size and expressive in a larger full-body pose.
- Sketch three distinct original options before locking: (A) open-book friend, (B) letter R character, (C) bookmark/speech-bubble creature.
- Mascot must be recognizable in grayscale; do not put more than 2–3 facial features on the icon.
- Usage: guide to first demo, microphone-quality prompts, invitation confirmation, library empty states, story completion.
- Never suggest that mascot is the voice owner's portrait; narrator images must use the owner's own permissioned selfie/avatar.
- Outputs later: source SVG, icon square, transparent sticker assets, animated Lottie/Rive only if worth performance cost.

## 4. Site information architecture
Public: `/`, `/stories`, `/stories/[slug]`, `/how-it-works`, `/family`, `/voices`, `/privacy`, `/terms`, `/help`.
Authenticated: `/app`, `/app/library`, `/app/listen/[editionId]`, `/app/family`, `/app/invitations`, `/app/voices`, `/app/record`, `/app/settings`, `/app/billing`.
Admin: `/admin/overview`, `/admin/books`, `/admin/voices`, `/admin/consent`, `/admin/usage`, `/admin/costs`, `/admin/reviews`.
Children navigate within a supervised `/app/kids` profile context, not a public child identity or independent login.

## 5. Homepage — required exact vertical order
1. **Top nav:** original Readli wordmark; Stories, How it Works, For Families; Login and Try It Free. Collapsible mobile navigation. Persistent, understated.
2. **Large animated hero:** confident headline, one-line value prop, visually delightful storybook world with mascot and family portrait motifs. Main CTA jumps to voice demo immediately visible at top/below fold. On mobile place CTA above imagery so it cannot be missed.
3. **UNGATED 'TRY YOUR VOICE' DEMO** (major section): 1-minute guided recording + a six-book passage picker directly underneath. No email, account or payment demanded before trial output.
4. **How families work:** Record → Approve → Invite → Listen, with original illustrations and clear voice-ownership consent language.
5. **Three ways to listen:** Mom and Dad, Grandparents, read-along storytime; photographs or illustrated scenes, not fake user endorsements.
6. **Curated kids shelf:** browse catalog by age band, duration, theme; six demo titles lead shelf; discovery CTA.
7. **Family circles:** illustrated visual with pending invitation 'Invite Grandpa' and an owner-control explanation.
8. **Trust and safety:** voices are consented, private by default; kids under parent-managed profiles; no targeted ads to children; clear deletion/permission UI.
9. **Final CTA + footer:** Start a family library; link privacy, copyright, accessibility, support.

## 6. Detailed ungated voice demo interaction
Design this as a small in-page product, not a fake modal mock. Client state stages:
`idle → consent → microphone_check → prompt_recording → review_take → uploading → cloning → passage_choice → generating → ready_playback → save_invite_offer`; error/expired/retry branches.

**Guest flow:**
1. Adult taps Try Now, receives a concise notice that their recording will be used to synthesize a short preview, is not public, and is deleted under a disclosed short retention policy. Confirm adult status and explicit processing consent with unchecked checkbox; camera selfie is optional and independently consented. No newsletter checkbox required.
2. Browser requests microphone only after action; record 60 seconds in-browser; display real amplitude meter (not fabricated), timer, stop/retry, device-quality checks and optional sample script in segments. Use `MediaRecorder` with capability checks and fallback for unsupported codecs; no audio capture before consent.
3. Review playback of original recording; click 'Make my preview'. Backend accepts short-lived anonymous signed guest session with rate limits, abuse controls, quota checks and expiring blob storage.
4. Processing status text accurately reflects real queue states; do not promise instant completion or fake it. Show a pre-recorded *clearly labeled* stock voice preview if cloning provider is unavailable; never pass it off as their clone.
5. **Directly under the recorder show a 3-column × 2-row desktop grid / 2-column mobile grid (or horizontal accessible carousel) with six public-domain story cards**. Each shows rights-cleared cover illustration, title, duration of *sample passage* (e.g. 30–60 seconds), and a 'Hear this passage' action. Buttons choose passage; guest's sample clone is applied to that passage, or if no clone yet, a labeled stock preview and a clear CTA to record first.
6. Short passages (target ≤45 seconds each) are fixed and editorially approved. Only one active selection/player at a time. Generation caches per guest session and passage, with a capped number of previews; never preload six costly synthesized outputs.
7. Show text in a beautiful open-book reader with phrase/sentence highlighting when verified alignment is available; no misleading highlighting if not.
8. After successful real preview, invite to 'Save your voice and make a family circle', but keep the initial result listenable without creating account. To save, sign up and explicitly re-consent to storage and ongoing usage; guest voice must not be silently retained indefinitely.
9. At expiration, guest assets are purged, including provider voice resources where API permits. Provide honest error if provider deletion fails and queue manual remediation.

**Recommended six launch sample books (rights-reviewed specific editions, no modern covers):**
- The Tale of Peter Rabbit — Beatrix Potter.
- The Tale of Benjamin Bunny — Beatrix Potter.
- The Wonderful Wizard of Oz — L. Frank Baum.
- Alice’s Adventures in Wonderland — Lewis Carroll.
- Peter Pan: Peter and Wendy — J. M. Barrie; use the 1911 novel (Project Gutenberg eBook #16), not later film adaptations.
- Winnie-the-Pooh — A. A. Milne; use the original 1926 text (Project Gutenberg eBook #67098), not Disney character artwork or later additions.
Store edition provenance and copyright assessment per jurisdiction; project Gutenberg listing does NOT authorize use of arbitrary modern edition artwork. Every passage needs a reviewed excerpt and canonical position ID.

**Demo anti-abuse:** guest UUID signed server-side; session expiry; IP/network abuse throttles; per-device/session quotas, max recording size and content filter, deduplicated submissions, spend ceiling, CAPTCHA only on risk escalation; minimize persistent IP capture. No biometric identity matching beyond necessary provider verification.

## 7. Mobile / tablet states
- iPhone 375–430 CSS px: stacked hero; sticky CTA optional; microphone prompt never causes horizontal overflow; record and retake buttons thumb reachable; dynamic permissions and Safari audio handling; selfie action invokes camera via browser with proper `capture="user"` fallback to file picker. Don't require selfie for demo.
- iPad 768–1024 CSS px: kids library large illustrated covers; immersive read-along split spread if width permits; family profiles parental lock; tablet landscape accessible.
- Desktop ≥ 1280 CSS px: hero illustration + CTA; wide demo with recording left, choices below (as specified), book reader side or inline expansion; no arbitrary sidebars during story playback.
- Respect notch/safe area, loading states, keyboard navigation, text zoom, contrast, reduced motion, offline/spotty networks.
- Audio interruption: preserve text position across tab sleep, phone calls, device route changes, refresh; browser-supported background playback using Media Session API where available.

## 8. Authenticated family UX
- Adults have own accounts, email verification, avatar/selfie with consent, relationship nickname, and optional public narrator profile later.
- Family circle invitation via email or copy/share link; pending member cards show 'Voice not here yet — Invite them'. Invitee explicitly accepts connection. Invite sender cannot upload/create clone of invitee.
- Child listening profile is guardian-managed, uses a nickname or icon (not full name/birth date unless required). Parent mode unlock protected by adult authentication / reauthentication.
- Voice tile shows face avatar, name or relationship, status (not invited/invited/recording/pending/ready/revoked), and scope (private, specific circles, public separately opted-in).
- Player features play/pause, chapter navigation, narrator chooser, resume at aligned sentence if available, book text/illustration mode, sleep timer, listening speed, progress synced.

## 9. Component inventory
`SiteHeader`, `HeroStoryWorld`, `ReadiMascot`, `VoiceDemo`, `ConsentGate`, `AudioPermissionPrompt`, `WaveformRecorder`, `QualityIndicator`, `RecordTakeReview`, `DemoBookShelf`, `DemoBookCard`, `DemoNarrationPlayer`, `ReadAlongPanel`, `FamilyCircleGraph`, `FamilyInviteCard`, `VoiceTile`, `KidBookCard`, `VoiceSwitcher`, `NarratorAvatar`, `RecordingCoach`, `LegalConsentReceipt`, `AccountUpgradePanel`, `MobileBottomNav`, `AdminCostMeter`, `EmptyState`, `SafeError`.

## 10. Design acceptance checklist
- [ ] Hero and 1-min demo obvious on 390px phone and wide desktop.
- [ ] Six books appear directly beneath voice demo and each produces a real, rights-reviewed preview in signed test environment.
- [ ] Zero signup barrier for guest preview; explicit processing consent is required.
- [ ] Voice identity is never inferred from selfie; selfie is optional and separate.
- [ ] No placeholder text/audio masquerades as functioning cloning.
- [ ] Accessibility: semantic controls, captions/transcript for demos, focus states, reduced motion, target size, contrast.
- [ ] Visually cohesive and lively with original character illustration; no generic AI SaaS look.
- [ ] Screenshot coverage: mobile 390px, tablet 820px, desktop 1440px; test with real device microphone restrictions.
