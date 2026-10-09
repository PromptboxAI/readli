# READLI — Standalone Build Amendment 001
**Title:** Continuous Scrolling Voice Recorder + Premium Voice & Public Narrator Upgrade
**Date:** October 9, 2026  
**Status:** Implementation instructions for Claude Code  
**Applies to:** Existing Readli Design Brief and Product PRD  
**Precedence:** This amendment supersedes conflicting recording, prompting, and upgrade specifications. Do not require the original files to be re-uploaded or rewritten.

## Instructions to Claude Code
Implement this as a standalone change request against the existing Readli codebase and documentation. Keep all previously agreed MVP scope unchanged unless expressly overridden below. First inspect existing recorder UI, audio collection, consent gate, voice tier, analytics, and recording-session interfaces. Modify those components rather than producing parallel duplicate implementations. If relevant functionality is not yet built, incorporate these requirements when building it. Do not claim ElevenLabs provides an embeddable scrolling recorder; the teleprompter is a Readli UI that records user-owned audio and sends it to the approved voice API.

## A. Replace the four-card / Next Prompt recorder
**DELETE / OVERRIDE:** PRD D-02 statement “four ... prompts ... each as a swipe/tap-next teleprompter card, auto/manual advance”; and any design-brief visuals/instructions depicting sentence-by-sentence Next Prompt navigation. Do not make users click Next to proceed while narrating.

**REPLACE WITH:** A single, continuous, automatically scrolling read-aloud script in a dedicated recording screen (teleprompter mode). The entire session is uninterrupted by page changes. The script may contain short paragraphs or naturally varying material, but must be experienced as one reading, not a slideshow.

### Demo / Family Voice mode (P0)
- Show unobstructed large-type script; desktop and mobile portrait. Maximize text readability and keep scrolling independent of page scroll. Ideally highlight the current line or reading region, with adjacent text gently deemphasized; no eye tracking, no automated assertions of precise spoken-word tracking.
- Reader taps **Start recording** to grant browser microphone permission, then recording begins. Show elapsed time, target-duration guidance, input meter, visible recording state and buttons for **Pause**, **Resume**, **Finish**, and **Start over**. Provide keyboard and screen-reader controls.
- Text scrolls smoothly in an adjustable teleprompter. Offer manual speed control, font-size adjustment, and a “follow my pace” mode only if real-time speech alignment is actually available and robust; otherwise use user-controlled scroll speed. Users can tap/drag to reposition without stopping audio.
- Target **60–120 seconds of clean speech**, with prompts long enough for slower readers; focus on clarity rather than meeting an exact second count. Show remaining suggested reading time, but do not abruptly cut off speech.
- Script should vary natural speech: gentle children's storytelling, conversational sentences, excited/surprised expressions, names/numbers, and different sentence lengths. It must read naturally, not as an artificial checklist. Maintain one continuous original, Readli-authored script; final copy is CMS-configurable and versioned.
- Support microphone test, quiet-room guidance, headset/mic suggestions, one-speaker warning, permissions denied, noisy/silent/too-short recordings, review and playback of the recorded take, retake, and upload-progress/error recovery. Client quality feedback is advisory; final server checks validate duration, codec, silence and file size.
- Works in Safari iOS and Chrome Android (front/rear camera is NOT required for voice demo); MediaRecorder MIME fallback, page visibility/backgrounding warnings, interruptions/call handling and recovery. No auto-recording on load.
- On completion continue to **six preapproved book excerpt cards directly under/after demo**, each playable via actual authorized generated voice audio; unauthenticated usage caps and abuse controls remain. Do not silently switch to a stock voice or fake synthesis when a clone fails.
- Consent and verified adult ownership declaration required **before** recording/cloning, but no signup/email required for the demo. Minimize guest retention, implement TTL deletion and provider cleanup.

### Premium Private Voice mode (P1; UI may be feature-flagged in P0)
- From existing Family Voice profile, provide an **Upgrade voice quality** entry point with benefit comparison, transparent price and usage charges (TBD / admin-configured), recorder compatibility check, and separate confirmation/consent.
- Use the **same scrolling teleprompter engine** as the short demo with long-form script sets, not Next Prompt cards.
- Target **~2 hours of usable, clean narration**; ElevenLabs guidance supports roughly 30–180 minutes, with more quality samples often beneficial. This is a quality target, not a hard technical minimum. An owner can record in separate **15–30 minute resumable sessions** across multiple days. Each session scrolls continuously while recording, with natural stopping points between sessions.
- Track `target_minutes`, `usable_minutes`, `recorded_minutes`, `segments_completed`, QC state, recording consistency and setup (microphone/environment). Allow session retakes, pause/resume, draft upload, and resuming from the correct script position on a new device.
- No automatic upgrade based solely on duration. Perform provider-supported owner verification, consent and train/processing status; explain that professional fine-tuning may not complete immediately. Do not assert a finished voice until the provider confirms it.
- Premium Private Voice remains PRIVATE by default. Existing private family-share grants require independent validation and are not replaced by a blanket public license.
- Premium upgrade is a separate paid product (price TBD) with no promise of perpetual synthesis/storage and no implied public narrator acceptance.

## B. Optional public narrator pathway (P2; model now, ship later)
A verified adult with an eligible Professional Voice Clone may select **Apply to become a Readli narrator**. This opens a distinct opt-in flow; never treat purchasing Premium or completing two hours as authorization to make the voice public.

Required application: full verified owner identity (private), approved public display name, consented face photo/avatar, sample audition, language/accent/genre preferences, availability, commercial synthetic-voice license, limitations on uses, royalty and payout agreement, and tax/payee onboarding when needed. Public discoverability requires both (1) explicit public narrator rights grant and (2) Readli human approval; publisher title-level approvals apply to licensed books. Draft → Applied → Under review → Approved / Rejected / Suspended. Revocation and contract handling must be implemented before production royalties.

Keep public narrator discovery, per-listening royalties, payout integrations, and publisher catalogue production OUT of launch P0. Provide feature flags, schema placeholders and separate P2 tickets, so the family/kids proof of concept ships first. A sponsored professional-clone invitation may be offered to promising candidates without charging an application fee.

## C. Voice tiers / entitlements (must not be conflated)
| Tier | Recording | Discovery | Family use | Compensation |
|---|---|---|---|---|
| Short Family (Instant Voice Clone) | ~1–2 min continuous scroll | Never publicly listed | Owner/explicitly approved family members, subject to provider contract | None |
| Premium Private (Professional Voice Clone) | Target ~2 hours, resumable | Never publicly listed by default | Same explicit private permissions | Paid upgrade (commercial price configurable) |
| Approved Public Narrator | Existing verified PVC + separate application and license | Listed only with consent + approval | May also be private if separately authorized | Qualified-listening royalties, future P2 |

### Rights and provider dependencies
- Keep Readli account identity, encrypted/limited provider voice references, consent receipts, individual access grants and family-circle permissions first-party. Never copy/expose raw voice model identifiers client-side.
- Confirm ElevenLabs terms for guest instant voice cloning, multi-account family listening, private synthesis, caching and storage, training owner verification, commercial narrated content, model deletion and posthumous licenses before production launch. A cloned voice cannot be created from a relative’s recordings without the actual owner’s consent and required verification.
- Do not promise model export or perpetual voice availability. An archived generated audio file and ongoing permission to synthesize new content are separate entitlements.

## D. Data / API modifications
Reuse existing `voice_training_sessions` / `voice_training_segments` and add if missing:
- `recording_mode` (`guest_short`, `family_short`, `premium_private`), `script_version_id`, `script_offset_start`, `script_offset_end`, `teleprompter_speed`, `usable_duration_ms`, `audio_qc_status`, `pause_events_count`, `device_class`, `recording_status` (`draft`, `recording`, `paused`, `uploaded`, `qc_failed`, `accepted`).
- `voice_upgrade_orders` + `voice_tiers` as specified in existing PRD; payment details only in server-controlled billing integration.
- `narrator_applications`, `narrator_licenses`, `narrator_auditions`, `narrator_book_approvals`, `narrator_royalty_ledger` as Phase 2 feature-flagged structures.
- Preserve event-level adult-only analytics: `recorder_started`, `recording_paused`, `recording_resumed`, `recording_completed`, `qc_rejected`, `preview_book_selected`, `demo_audio_played`, `premium_upgrade_viewed`, `premium_recording_resumed`, `narrator_application_started/submitted` (P2). Do not place raw voice, transcripts of household recordings, or identifiable child activity in advertising analytics.
- Consent receipt must be linked to each source voice and policy version; review access grants server-side on every narration request.

Suggested endpoints, if not already available: `GET /api/voice-scripts?mode=...`, `POST /api/recording-sessions`, `PATCH /api/recording-sessions/:id`, `POST /api/recording-sessions/:id/segment`, `POST /api/recording-sessions/:id/complete`, `POST /api/voices/:id/upgrade`, `POST /api/narrator-applications` (P2 only). Follow existing auth and signed upload conventions, never expose ElevenLabs secret credentials to browser.

## E. Design requirements
- Same vibrant Readli family brand: marketing feels like Sago Mini's character-led animated world; kids experience takes Lingokids clarity and bold color as inspiration. Do not reproduce protected artwork, logos or site structure directly.
- Demo teleprompter must fit a 375px phone viewport; keep reading text prominent and recording controls thumb-reachable. No tiny next/previous prompt buttons.
- Desktop presents script alongside recording status; phone stacks text over compact fixed controls. Teleprompter respects reduced-motion preferences and has manual scroll fallback.
- Recording success transitions to a playful choose-a-book gallery of SIX excerpts (Peter Rabbit, Benjamin Bunny, Wizard of Oz, Alice in Wonderland, Peter Pan, Winnie-the-Pooh). Use rights-reviewed original editions/illustrations only.
- Premium upgrade uses progress visualization (usable minutes toward target), clear save/resume feedback, and friendly non-pushy messaging. Do not imply a user is a paid narrator simply because their voice is trained.

## F. Acceptance tests
1. A guest on Safari iPhone can explicitly consent, record **one continuous 60–120s script** without tapping Next, preview/retry the take, pick a sample book and hear a real synthesized excerpt without signup.
2. The same works on Chrome Android and desktop; mic permission errors, orientation change and interrupted recording recover correctly.
3. Adjustable teleprompter scroll speed and text size function independently of microphone capture; manual scrolling is supported.
4. Voice generation is blocked without consent; guest data is expired/deleted per retention policy; abuse caps are enforced.
5. A signed-in adult can see Premium benefits and (when enabled) complete multiple 15–30m continuous reading sessions, log out, sign back in and resume from the correct script position, with accurate usable-minute progress.
6. Private voice profile never becomes publicly searchable merely because it was upgraded to PVC.
7. An eligible private PVC can start but cannot complete public marketplace listing without a separate owner consent, commercial agreement and admin approval; P2 UI remains disabled in MVP.
8. Family sharing remains server-authorized and is never inferred from family-tree display or email address.
9. Six demo passages remain exactly the selections locked in the prior documents; only the recording interaction is being replaced by this amendment.

## G. Implementation order
1. Replace multi-card prompt UI with Readli-owned scrolling script recorder; preserve backend demo quota/consent and six-book excerpt selection.
2. Test on actual mobile browsers with real audio capture and API-generated result.
3. Wire feature-flagged premium recording sessions/resumption, tier entitlements and admin-configured upgrade pricing.
4. Scaffold consent-separated narrator application state and backend schema; do not launch public marketplace or payouts until a later PRD/release.

**Definition of done:** Existing PRD remains source of truth except wherever this amendment expressly overrides it. No duplicate files or full document replacement necessary. Write the implementation to the existing project, update existing tests, and flag any provider-contract blockers instead of simulating successful voice cloning.
