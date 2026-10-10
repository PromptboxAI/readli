# Readli

Every Book. Every Voice.

Family storybooks read in the voices of the people kids love. Product documents live in [`docs/`](docs/):
the PRD, Design Brief, Amendment 001, the [build plan](docs/amendment-001-plan.md) and the
[decisions log](docs/decisions.md).

## Develop

```bash
npm install
npm run dev          # http://localhost:3000, recording at /try
VOICE_PROVIDER=stub npm run dev   # full preview flow without keys (stand-in tone, in-memory storage)
npm run lint
npm run typecheck
npm test             # unit tests
npm run test:e2e     # browser tests at 375 / 820 / 1440 px; screenshots in e2e/screenshots/
```

Copy `.env.example` to `.env.local` when Supabase and ElevenLabs are connected (Phase 2). Secrets are server-only and
never committed.

Database migrations are in `supabase/migrations/`.
