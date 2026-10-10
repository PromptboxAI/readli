# Readli — Build Plan with Amendment 001 Applied

**Date:** 2026-10-09
**Status:** Proposed plan for review. No implementation code has been written yet.
**Source documents (unchanged, in this folder):**
- [`READLI_PRODUCT_PRD.md`](READLI_PRODUCT_PRD.md) (PRD v1.0)
- [`READLI_DESIGN_BRIEF.md`](READLI_DESIGN_BRIEF.md) (Design Brief v1.0)
- [`READLI_STANDALONE_AMENDMENT_001.md`](READLI_STANDALONE_AMENDMENT_001.md) (Amendment 001)

## 0. Starting point

There is no Readli code yet. The repository holds only the three documents above. That simplifies Amendment 001: instead of tearing out a four-card "Next prompt" recorder, we build the continuous scrolling teleprompter from day one and never build the card version.

Because nothing exists, each phase below compares **what the original PRD/brief specified** with **what Amendment 001 changes**, then lists what gets built. Where the amendment is silent, the PRD and design brief remain the source of truth.

The phase order follows Amendment 001 section G (recorder first, real-device testing second, Premium third, narrator scaffolding fourth), slotted into the PRD's own milestones (section 13) where the amendment depends on them. Premium recording needs accounts, so the PRD's Families phase has to land before G3.

| # | Phase | Amendment G step | PRD milestone |
|---|---|---|---|
| 1 | Foundation and experience system | (prerequisite) | Phase 0 |
| 2 | Guest demo with continuous teleprompter + six books | **G1** | Phase 1 |
| 2b | Homepage design pass ([Design Revision 001](design-revision-001.md)) | (design) | Phase 0 polish |
| 3 | Real mobile browser and audio verification | **G2** | Phase 1 exit gate |
| 4 | Accounts, families and Family Voice recording | (prerequisite for G3) | Phase 2 |
| 5 | Premium Private Voice (feature-flagged) | **G3** | Later → pulled forward, flagged |
| 6 | Narrator application scaffolding (P2, disabled) | **G4** | Later |
| 7 | Library, player and narrator switching | (unchanged) | Phase 3 |
| 8 | Launch and evidence | (unchanged) | Phase 4 |

Phases 6 and 7 are independent and can swap or run in parallel; phase 6 is small (schema, flags, disabled UI).

---

## 1. What Amendment 001 overrides

| Topic | Original docs | Amendment 001 (wins) |
|---|---|---|
| Recorder interaction | PRD F-03 "guided script modules"; brief §6 "optional sample script in segments"; amendment cites PRD D-02 "four prompts, swipe/tap-next cards" | One continuous auto-scrolling script on a dedicated recording screen. No Next button, no slideshow, no page changes mid-take. |
| Demo duration | PRD F-01 target 60–90s; brief "record 60 seconds" | 60–120s of clean speech; show remaining suggested time; never cut speech off abruptly. |
| Recorder controls | Brief: timer, stop/retry, amplitude meter | Start recording, Pause, Resume, Finish, Start over; elapsed time, target guidance, input meter, visible recording state; keyboard and screen-reader operable. |
| Teleprompter controls | (none) | Adjustable scroll speed, font size, tap/drag reposition without stopping audio, reduced-motion manual fallback. "Follow my pace" only if robust speech alignment exists (it doesn't yet, so it stays off). |
| Script content | Unspecified "guided script" | One original Readli-authored script mixing storytelling, conversation, excitement/surprise, names/numbers and varied sentence length. CMS-configurable and versioned. |
| Professional voice | PRD F-03: "separate guided 30–180 min recording series", flagged | Premium Private Voice: same teleprompter engine, ~2h target, 15–30 min resumable sessions across devices, separate paid product and consent, private by default. |
| Public narrator | PRD: future role `narrator_applicant`, out of scope | P2 modeled now: schema, state machine and flags; UI disabled; no marketplace, royalties or payouts at launch. |
| Recording data | PRD `voice_samples` only | Reuse/introduce `voice_training_sessions` + `voice_training_segments` with recording mode, script offsets, QC and status fields (section D). |
| Analytics | PRD F-08 event list | Adds recorder lifecycle, QC, Premium and narrator events (see Phase 2 and 5). |
| Demo client stages | Brief §6 `... → prompt_recording → ...` | `prompt_recording` becomes `teleprompter_recording` with `paused` sub-state. |

**Explicitly unchanged:** the six-book demo pattern (the titles were later changed by Kevin on 2026-10-10, see `decisions.md`), consent-before-recording, no signup for the demo, guest quotas and TTL deletion, honest failure states, all family/circle/grant rules, the homepage section order, brand tokens and IA.

---

## Phase 1 — Foundation and experience system

**Original spec:** PRD Phase 0 and work order steps 1–4: Next.js App Router + TypeScript + Tailwind, Supabase, design tokens, homepage in the brief's exact order, six provenance-tagged book cards, clearly mock-labelled recorder/player, screenshot approval before API work.

**Amendment change:** the mock recorder screen is the continuous teleprompter, not prompt cards. The 375px-viewport layout rule (amendment E) applies from the first screenshot.

**Build:**
- Repo scaffold: Next.js (App Router, TS strict), Tailwind with CSS-variable tokens from brief §2, ESLint/Prettier, Vitest + Playwright, CI on GitHub Actions.
- `docs/decisions.md` with vendor gates and open questions (PRD §15.1), seeded from section 9 of this plan.
- Typed domain model and first Supabase migrations: users/profiles, guest sessions, consent receipts, books/editions/chapters/canonical segments/demo passages, feature flags, analytics events. RLS on from the start.
- Homepage in brief §5 order: header, hero with Readi mascot placeholder, demo section, how families work, three ways to listen, kids shelf, family circles, trust and safety, footer.
- `DemoBookShelf` + `DemoBookCard` with the six books, provenance placeholders, audio feature-flagged off until passages are approved.
- Static, clearly labelled **teleprompter mock**: full-screen script, scroll engine, speed and font controls, Pause/Resume/Finish/Start over buttons wired to a fake recorder state. Lets us approve the reading experience before any microphone work.
- Screenshot tests at 375/390, 820 and 1440 widths.

**Exit:** you approve homepage and teleprompter screenshots.

---

## Phase 2 — Guest demo with continuous teleprompter (Amendment G1)

**Status (2026-10-10):** client capture done; server side built and tested against the stand-in provider. Routes: `POST /api/guest/session`, `POST /api/guest/recording`, `POST /api/guest/clone`, `POST /api/demo/generate`, `GET /api/demo/status`, `GET /api/cron/guest-cleanup`. Waiting on Supabase and ElevenLabs keys for the live run. Scripts are served from code for now (seeded into `voice_script_versions` by migration); the separate recording-session endpoints collapse into one upload per take because a guest take is a single file.

**Original spec:** PRD J1 / F-01 / Phase 1 and brief §6: consent → mic test → record → review → clone → six-book picker → real synthesized passage, no signup, quotas, TTL cleanup, honest states.

**Amendment change:** recording is one continuous scrolling read of 60–120s with pause/resume and repositioning; richer quality and interruption handling; script versioned in a CMS; adult-ownership declaration explicitly before recording.

**Build:**

*Teleprompter engine (shared by every recording mode):*
- `TeleprompterRecorder` component with a `mode` prop (`guest_short`, `family_short`, `premium_private`). Two independent subsystems:
  - **Scroll engine:** `requestAnimationFrame` scroller inside its own scroll container (independent of page scroll), speed in words/min, font-size steps, current-region highlight with adjacent lines de-emphasized, tap/drag to reposition, keyboard (Space pause/resume, arrows nudge, +/− speed), `prefers-reduced-motion` switches to manual scroll with large step buttons.
  - **Capture engine:** `getUserMedia` + `MediaRecorder` with MIME negotiation (`audio/webm;codecs=opus` → `audio/mp4` → `audio/aac` fallbacks for Safari), `AnalyserNode` input meter, pause/resume via `MediaRecorder.pause()`, elapsed-speech timer, visibility/backgrounding warnings, interruption recovery (call, route change, tab sleep).
  - Script position (character offsets) recorded alongside pause events so a session knows `script_offset_start/end`.
- Layout: desktop puts script beside recording status; phone stacks script over compact fixed thumb-reach controls. No small next/previous buttons anywhere.
- Pre-flight: mic test, quiet-room and headset tips, one-speaker notice, permission-denied guidance.
- Review: playback of the take, retake, advisory client QC (too short, silent, clipping, noisy). Server QC is authoritative.

*Script content:*
- `voice_scripts` / `voice_script_versions` tables (mode, locale, body, word count, estimated read time, published_at). Admin-editable later; seeded with one original Readli-authored ~250–300 word demo script. Default CMS choice is these Supabase tables plus a simple admin page (see decisions).

*Backend (PRD §7 routes plus amendment D):*
- `POST /api/guest/session` after consent + adult declaration; consent receipt tied to policy version.
- `GET /api/voice-scripts?mode=guest_short`.
- `POST /api/recording-sessions`, `PATCH /api/recording-sessions/:id`, `POST /api/recording-sessions/:id/segment` (signed upload), `POST /api/recording-sessions/:id/complete` (server QC: duration, codec, silence, size).
- `POST /api/guest/clone` → `VoiceProvider` adapter → ElevenLabs IVC; `GET /api/guest/jobs/:id`.
- `GET /api/demo/books`, `POST /api/demo/generate` with 1 generation + 1 retry default, single concurrent job, per-session/IP throttles, global spend kill switch.
- TTL cleanup job deleting guest audio, clone and provider voice; failures queued for remediation.
- No stock-voice substitution for a failed clone; any generic sample is labelled as not their voice.

*Schema additions (amendment D):* `voice_training_sessions` and `voice_training_segments` with `recording_mode`, `script_version_id`, `script_offset_start`, `script_offset_end`, `teleprompter_speed`, `usable_duration_ms`, `audio_qc_status`, `pause_events_count`, `device_class`, `recording_status` (`draft`, `recording`, `paused`, `uploaded`, `qc_failed`, `accepted`). Guest sessions link via `guest_session_id`; user sessions via `owner_id`.

*Analytics:* PRD funnel events plus `recorder_started`, `recording_paused`, `recording_resumed`, `recording_completed`, `qc_rejected`, `preview_book_selected`, `demo_audio_played`. Proposed mapping to avoid double counting: amendment names replace PRD `record_start` → `recorder_started`, `record_success` → `recording_completed`, `sample_book_select` → `preview_book_selected`, `preview_play` → `demo_audio_played`. No audio, transcripts or child data in analytics.

**Exit:** amendment acceptance tests F-1 (desktop and emulators), F-3, F-4, F-9 pass; PRD §14 guest tests pass in automation.

---

## Phase 2b — Homepage design pass (Design Revision 001)

**Source:** designer notes of 2026-10-10, recorded in [`design-revision-001.md`](design-revision-001.md). Kevin likes the current direction; this is polish, not a rebuild.

**Build:** interactive family tree (7+ members, statuses, explorable without signup, pan + list view on mobile), bookstore-style six-book shelf, Readi as one recurring guide, richer section composition. Built against current placeholders so final assets drop in.

**Mascot:** selected design received 2026-10-10 with At rest and Listening states ([reference](design/readi-mascot-states.png)).

**Waits on:** the new Readli logo (in progress with Kevin's designer), SVG source for the mascot, hero/use-case illustrations and rights-cleared covers.

**Timing:** after Phase 2's cloning work lands. The interaction work can also fill gaps while Phase 2 waits on ElevenLabs/Supabase access.

**Exit:** no empty illustration placeholders remain once assets arrive; screenshots at 375 / 820 / 1440; everything in the revision's "must not break" list still works.

---

## Phase 3 — Real mobile browser and audio verification (Amendment G2)

**Original spec:** PRD requires Safari iOS and Chrome Android; brief §7 lists mobile states.

**Amendment change:** made an explicit gate: real devices, real capture, real API output, plus orientation change and interruption recovery.

**Build / do:**
- Test matrix: iPhone Safari (current and previous iOS), Chrome Android, desktop Chrome/Edge/Safari. BrowserStack or physical devices (you choose; see decisions).
- Scripted manual runbook covering F-1 and F-2: consent, full 60–120s read without Next, pause/resume, drag reposition, orientation flip mid-take, incoming call/backgrounding, denied then granted mic, retake, upload failure and retry, pick a book, hear real synthesized audio.
- Fix codec, autoplay and audio-session issues found. Record results in `docs/device-test-results.md`.
- Measure real cost per preview from provider logs and set the spend cap.

**Exit:** F-1 and F-2 pass on real iPhone and Android; cost per preview recorded.

---

## Phase 4 — Accounts, families and Family Voice recording

**Original spec:** PRD J2–J5, F-02, F-03, F-04, Phase 2: Supabase Auth, guest claim, profiles and optional selfie, circles, invitations, voice grants, child profiles, revoke/delete.

**Amendment change:** the signed-in Family Voice (`family_short`) recording uses the same teleprompter; family sharing must stay server-authorized and never inferred from tree display or email (F-8). Otherwise unchanged.

**Build:** as PRD Phase 2, with `/app/record` rendering `TeleprompterRecorder mode="family_short"`, `voice_profiles.clone_type = instant`, consent receipt per source voice and policy version, `voice_grants` checked server-side on every narration request, RLS negative tests for cross-circle and revoked access.

**Exit:** PRD §14 family tests and amendment F-8 pass.

---

## Phase 5 — Premium Private Voice, feature-flagged (Amendment G3)

**Original spec:** PRD F-03 professional voice "separate guided 30–180 min series", F-07 configurable pricing, `voice_upgrade_orders` / `voice_tiers` referenced.

**Amendment change:** concrete Premium product: same teleprompter with long-form script sets, ~2h target in 15–30 min resumable sessions, cross-device resume at the right script position, progress tracking, separate consent and price, provider owner verification, no "finished" claim until the provider confirms, private by default.

**Build (behind `premium_voice` flag):**
- `voice_tiers` (short_family, premium_private, public_narrator) and `voice_upgrade_orders`; admin-configured pricing; payment via server-side Stripe integration only (Stripe itself may stay stubbed until billing is approved).
- "Upgrade voice quality" entry on the Family Voice profile: benefit comparison, transparent price/usage, compatibility check, separate consent.
- Long-form script sets (`voice_script_versions` with `mode = premium_private`, ordered chapters with natural stopping points).
- Session tracking: `target_minutes`, `usable_minutes`, `recorded_minutes`, `segments_completed`, QC state, consistency and setup notes. Draft uploads every few minutes so a dropped connection loses little.
- Resume: server stores last accepted `script_offset_end`; any device resumes there.
- Progress UI: usable minutes toward target, clear saved/resumed feedback, non-pushy copy.
- Provider: PVC creation, owner verification, training status polling; status shows "training" until provider confirms.
- `POST /api/voices/:id/upgrade`; events `premium_upgrade_viewed`, `premium_recording_resumed`.

**Exit:** F-5 and F-6 pass with the flag on; flag off in production by default.

---

## Phase 6 — Narrator application scaffolding (Amendment G4, P2)

**Original spec:** out of scope (future `narrator_applicant`).

**Amendment change:** model now, ship later.

**Build (all behind `narrator_program` flag, off):**
- Tables: `narrator_applications` (Draft → Applied → Under review → Approved / Rejected / Suspended), `narrator_licenses`, `narrator_auditions`, `narrator_book_approvals`, `narrator_royalty_ledger`.
- Server rules: public discoverability requires both an explicit rights grant and admin approval; buying Premium or hitting 2h never sets it.
- Disabled "Apply to become a Readli narrator" entry; `POST /api/narrator-applications` returns 403 while the flag is off.
- Separate P2 tickets for discovery, royalties, payouts, revocation and contracts.

**Exit:** F-7 passes (can start, cannot complete; UI disabled in MVP).

---

## Phase 7 — Library, player and narrator switching

**From PRD Phase 3:** 20–30 rights-reviewed editions, reader with text/illustrations, generation queue and cache, canonical-segment narrator switching, cross-device resume, basic admin.

**Narrator switching is launch-critical** (PRD F-06 / J4, confirmed by the designer 2026-10-10). Phase 8 cannot start until it passes. Kids player requirements:
- The current narrator's selfie avatar sits prominently in the player, never inside a settings menu.
- Tapping the avatar opens a visual selector of every voice this child profile is authorized to hear (server-checked `voice_grants`; other families' private voices are never listed or returned).
- Switching works on any page, including during playback, and as many times as wanted in one book.
- Position is kept by canonical sentence (`canonical_segment_id`), resuming at the same sentence or the nearest sentence boundary, never the start of the chapter or book.
- The current page stays on screen while switching.
- If the new voice's audio isn't cached, show Readi in the **Listening** state as the loading animation (static under reduced motion), then resume automatically in the new voice.
- Generation for the new voice starts at the current sentence and runs a few segments ahead, rather than re-rendering the whole book, to protect credits.
- Every switch is logged (`voice_switch_events`, `narrator_switch` / `resume_after_switch` events).

**Acceptance (from the designer's example):** a child starts Peter Rabbit in Mom's voice, taps Grandpa's avatar on page 3, and the story continues from the same sentence in Grandpa's voice, with the page unchanged; switching back to Mom later works the same way.

## Phase 8 — Launch and evidence

**Unchanged from PRD Phase 4:** analytics dashboard, privacy review, accessibility/performance QA, referrals, 50-family beta, buyer demo package. Adds the amendment's recorder and Premium events to the dashboards.

---

## 9. Decisions and blockers

Defaults I'll use unless you say otherwise:

| Question | Default |
|---|---|
| Script CMS | Supabase tables + small admin editor (no third-party CMS) |
| Background jobs | Inngest (works on Vercel, durable retries) |
| Hosting | Vercel + Supabase cloud |
| Device testing | Your own iPhone/Android for G2, BrowserStack optional |
| "Follow my pace" | Off; manual speed only until robust alignment exists |
| Event names | Amendment names replace overlapping PRD names (Phase 2 mapping) |
| Demo script copy | I draft an original script for your review |

Provider and legal gates to clear before production (from PRD §9 and amendment C), flagged rather than simulated:
1. ElevenLabs written terms for anonymous guest IVC, multi-account family listening, caching, deletion and posthumous use.
2. ElevenLabs PVC owner-verification flow and API access on our plan.
3. Premium pricing and usage charges (admin-configured; TBD).
4. Rights review of the six specific editions and any illustrations.
5. COPPA / biometric privacy counsel sign-off.

What I need from you to start Phase 1: a go on this plan. An ElevenLabs API key and Supabase project are needed from Phase 2 onward, added as environment secrets, never committed.
