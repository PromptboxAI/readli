# Decisions and open questions

Living log required by PRD §15 step 1. Newest first. Vendor and legal gates are
tracked here and never assumed cleared in code.

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-10 | **Homepage demo books changed** to Peter Rabbit, Alice in Wonderland, Winnie-the-Pooh, The Three Little Pigs, The Princess and the Pea, The Lion and the Mouse. Benjamin Bunny, Wizard of Oz and Peter Pan dropped. Supersedes the PRD/Brief/Amendment F-9 lock | Kevin's decision |
| 2026-10-10 | Guest previews run in three modes: live (Supabase + ElevenLabs + cookie secret), stub (VOICE_PROVIDER=stub, local dev and CI, stand-in tone clearly labelled) and off (anything else, or DEMO_AUDIO_ENABLED=false). Live also obeys the `demo_audio` feature flag | Claude; PRD kill switch |
| 2026-10-10 | Two free previews per guest, one voice clone per take, at most three clones per guest; a failed synthesis refunds the preview | PRD F-01 "1 generation + 1 retry"; Claude |
| 2026-10-10 | Generated preview audio is streamed back and not stored; only the take and the encrypted provider voice id are kept, both deleted with the guest | Claude; data minimisation |
| 2026-10-10 | **Family voices are private by default (Amendment 002, launch-critical).** A child hears a family voice only while two independent keys are valid: the owner's share with the household (`voice_household_shares`) and a guardian's approval for that child (`child_voice_approvals`). Tree links, membership and relationship labels grant nothing. New voices start off for every child; an owner's revocation cascades to every approval and to generated audio, and sharing again starts off. Parents can't approve an unshared voice. Every generate, list and audio fetch re-checks both keys on the server (`src/lib/family/permissions.ts`, mirrored by `child_can_hear_voice()` and triggers in the migration). Grants and revocations go to an append-only `permission_audit_log` | Kevin's amendment |
| 2026-10-10 | **Signup and pricing (Kevin's amendment):** paid Readli Family ($14.99/month: 2 narrator slots, up to 6 kids, 3 kids listening at once) and free Readli Voice for contributors. Narrator slots are a third gate: owner shares → household puts the voice in a slot it is entitled to → guardian approves per child. Consent never activates a voice; freeing a slot ends that voice's approvals; at most 4 slot releases per 30 days. Extra slot $2.99/month is shown as pending approval and payments stay off. Gift and donated memberships use the same `household_entitlements` row. Plan numbers live in `plan_settings` / `src/lib/family/plan.ts` for the admin portal. Signup screens, checkout, contributor dashboard and admin UI are built in the invitations thread | Kevin's amendment; split agreed between threads |
| 2026-10-10 | Until Phase 4 sign-in exists, the family portal and kids player run as a preview family (`/family`, `/kids`) on a signed cookie with an in-memory household per visitor. On in dev and tests, off in production unless `FAMILY_DEMO=1`. Kids profiles open only from a signed-in guardian; real accounts replace `src/lib/family/session.ts` only | Claude |
| 2026-10-10 | Adult sign-in offers Google alongside email (Supabase Google provider). Phase 4 adds "Continue with Google" via `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` and an `/auth/callback` route that exchanges the code | Kevin, via the Supabase and Vercel setup thread |
| 2026-10-10 | Covers are original on-brand Readli artwork (one PNG per book), never scans of historic editions | Kevin; rights hygiene |
| 2026-10-10 | Premium Private Voice rollout: launch with family voices only; once the platform pays for itself (around 500 families), move to a custom/Enterprise ElevenLabs plan and offer Premium as a pilot. Premium stays built behind its flag until then | Kevin's decision |
| 2026-10-10 | Hosting on Vercel + Supabase cloud | Confirmed by Kevin |
| 2026-10-10 | Phase 3 device testing on Kevin's own iPhone/Android | Confirmed by Kevin |
| 2026-10-10 | Demo script stays Readli-authored; ElevenLabs supplies no training script (IVC guide: "find a script that fits the tonality"). Only PVC verification shows provider text (captcha image), handled in Phase 5 | Amendment §A; ElevenLabs docs |
| 2026-10-10 | Script v2 keeps one steady warm read-aloud tone | ElevenLabs IVC guidance: mixed energy can destabilise a clone |
| 2026-10-10 | Capture constraints: mono, echo cancellation on, noise suppression and auto gain off; 192 kbps | Browser DSP artefacts get copied into clones; ElevenLabs recommends 192 kbps+ |
| 2026-10-10 | Microphone released as soon as a take finishes; recording stays in the browser until upload exists | Least access; nothing leaves the device before the guest-session API |
| 2026-10-10 | Next.js 15 App Router, TypeScript strict, Tailwind v4 tokens in `src/app/globals.css` | PRD §8 stack; tokens from Design Brief §2 in one place |
| 2026-10-10 | Recorder is a continuous teleprompter from day one; no four-card prompt UI is ever built | Amendment 001 §A; no prior code existed |
| 2026-10-10 | Teleprompter scroll and capture are separate: `scroll.ts` (pure math) and `recorder-machine.ts` (pure reducer) | Amendment F-3: speed/size independent of mic capture; lets Phase 2 swap the mock clock for MediaRecorder without touching scrolling |
| 2026-10-10 | "Follow my pace" is not offered | No robust real-time speech alignment available; amendment allows manual speed only |
| 2026-10-10 | Reduced motion turns auto-scroll off by default; reader drags or uses arrow keys | Amendment §E, Brief §2 |
| 2026-10-10 | Recording auto-pauses when the page is hidden | Amendment §A backgrounding/interruption handling |
| 2026-10-10 | Demo script lives in `src/lib/content/voice-scripts.ts` until Phase 2 seeds `voice_script_versions` | Keeps copy reviewable now; table is the CMS later |
| 2026-10-10 | Scripts CMS = Supabase tables + small admin editor (no third-party CMS) | Fewer vendors; versioned rows already modelled |
| 2026-10-10 | Background jobs: Inngest (proposed) | Durable retries on Vercel for cloning, generation, TTL cleanup |
| 2026-10-10 | Amendment event names replace overlapping PRD names: `record_start`→`recorder_started`, `record_success`→`recording_completed`, `sample_book_select`→`preview_book_selected`, `preview_play`→`demo_audio_played` | Avoid double counting |
| 2026-10-10 | Book cover tiles are original placeholder shapes; no edition artwork until rights review | Brief §6, PRD F-05 |

## Open questions for Kevin

1. Supabase project and ElevenLabs account (paid plan for cloning) so Phase 2 can call real APIs.
2. **Guest deletion timing.** Vercel Hobby crons run at most daily, so `/api/cron/guest-cleanup` runs at 05:00 UTC and each new guest session also clears a few expired ones. To guarantee deletion within 24 hours, move to Vercel Pro (hourly cron) or shorten the guest TTL.
3. **Passage wording.** The six passages were written from the public-domain texts without access to Project Gutenberg from the build machine. Check each against its source before launch.

## Vendor and legal gates (block production, not development)

| Gate | Source | Status |
|---|---|---|
| ElevenLabs written terms for anonymous guest IVC, multi-account family listening, caching, deletion, posthumous use | PRD §9.1, Amendment C | Open |
| ElevenLabs PVC owner verification and API access on our plan | PRD §9.2, Amendment A | Open |
| Premium price and usage charges | Amendment A | Open (admin-configured) |
| ElevenLabs voice-slot capacity (pricing page 2026-10-10: Creator 30, Pro 160, Scale 660, Business 2,200, Enterprise custom; help centre still says Business 660). PVCs count inside the total. One Readli account holds every user's voice, so guest voices must free their slot promptly and launch needs an Enterprise agreement | Kevin Q&A | Open |
| **Premium Private Voice is not viable on standard plans**: PVC allowance is Creator/Pro 1, Scale 3, Business 10, Enterprise custom, with no add-on purchase. Premium (Phase 5) needs an Enterprise PVC allowance before it can be sold | ElevenLabs help centre | Open, blocks Phase 5 launch (not build) |
| Public-domain sources for the six books | PRD §9.4 | General note (Kevin, 2026-10-10): all six are public-domain classics, so the site makes no mention of rights review. Before audio goes live, record which public-domain text each passage comes from (Winnie-the-Pooh #67098, Peter Rabbit #14838, Alice #11, Brooke's Three Little Pigs 1904, Aesop for Children 1919, and a pre-1930 Princess and the Pea translation) |
| COPPA / state biometric privacy counsel sign-off | PRD §9.3 | Open |
| Guest retention window (proposed 24h) confirmed by counsel | PRD F-01 | Open |
