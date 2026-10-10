# Decisions and open questions

Living log required by PRD §15 step 1. Newest first. Vendor and legal gates are
tracked here and never assumed cleared in code.

## Decisions (Phase 1)

| Date | Decision | Why |
|---|---|---|
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

1. Hosting: Vercel + Supabase cloud OK?
2. Device testing for Phase 3: your own iPhone/Android, BrowserStack, or both?
3. Demo script copy (`voice-scripts.ts`): approve or edit.

## Vendor and legal gates (block production, not development)

| Gate | Source | Status |
|---|---|---|
| ElevenLabs written terms for anonymous guest IVC, multi-account family listening, caching, deletion, posthumous use | PRD §9.1, Amendment C | Open |
| ElevenLabs PVC owner verification and API access on our plan | PRD §9.2, Amendment A | Open |
| Premium price and usage charges | Amendment A | Open (admin-configured) |
| Rights review of the six specific editions, passages and any illustrations | PRD §9.4 | Open. Gutenberg #16 and #67098 are named in the PRD; #14838, #14407, #55, #11 need edition confirmation |
| COPPA / state biometric privacy counsel sign-off | PRD §9.3 | Open |
| Guest retention window (proposed 24h) confirmed by counsel | PRD F-01 | Open |
