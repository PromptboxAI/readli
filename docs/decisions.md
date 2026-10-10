# Decisions and open questions

Living log required by PRD §15 step 1. Newest first. Vendor and legal gates are
tracked here and never assumed cleared in code.

## Decisions

| Date | Decision | Why |
|---|---|---|
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

## Vendor and legal gates (block production, not development)

| Gate | Source | Status |
|---|---|---|
| ElevenLabs written terms for anonymous guest IVC, multi-account family listening, caching, deletion, posthumous use | PRD §9.1, Amendment C | Open |
| ElevenLabs PVC owner verification and API access on our plan | PRD §9.2, Amendment A | Open |
| Premium price and usage charges | Amendment A | Open (admin-configured) |
| ElevenLabs voice-slot capacity (pricing page 2026-10-10: Creator 30, Pro 160, Scale 660, Business 2,200, Enterprise custom; help centre still says Business 660). PVCs count inside the total. One Readli account holds every user's voice, so guest voices must free their slot promptly and launch needs an Enterprise agreement | Kevin Q&A | Open |
| **Premium Private Voice is not viable on standard plans**: PVC allowance is Creator/Pro 1, Scale 3, Business 10, Enterprise custom, with no add-on purchase. Premium (Phase 5) needs an Enterprise PVC allowance before it can be sold | ElevenLabs help centre | Open, blocks Phase 5 launch (not build) |
| Rights review of the six specific editions, passages and any illustrations | PRD §9.4 | Open. Gutenberg #16 and #67098 are named in the PRD; #14838, #14407, #55, #11 need edition confirmation |
| COPPA / state biometric privacy counsel sign-off | PRD §9.3 | Open |
| Guest retention window (proposed 24h) confirmed by counsel | PRD F-01 | Open |
