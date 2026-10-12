# Retention and provider audit (internal, 2026-10-12)

Internal audit and legal draft. Not customer-facing. Kevin's "Final Credit Refund, Data Retention and
Provider Configuration Decisions" and "Retention and Provider Audit Review" asked where Readli data lives,
for how long, and what must be confirmed in each account before launch.

The customer-facing Privacy Policy has no `TO BE CONFIRMED` markers (a test fails if one comes back). It
says backups and logs expire on schedules set by the providers' plans, without numbers. The open items are
tracked here instead. Once each is confirmed, the Privacy Policy is updated to state the actual period and
any exception.

Provider documentation was read through search excerpts of the providers' own pages on 2026-10-12, not
from the live pages. Check the wording on the live page before relying on it.

## Unconfirmed items (internal markers)

| Marker | What to fill in | Where the answer comes from |
|---|---|---|
| [DATABASE BACKUP PERIOD TO BE CONFIRMED] | Daily backup retention, and the PITR window if PITR is on | Supabase dashboard, checklist item 1 |
| [LOG RETENTION PERIODS TO BE CONFIRMED] | Supabase, Vercel and any drain destination | Checklist items 2 to 4 |
| [ELEVENLABS DATA-USE SETTING TO BE CONFIRMED] | Whether "Improve the models for everyone" is off; plan; DPA | Checklist item 5 |
| [ELEVENLABS SAMPLE PURGE TIMING TO BE CONFIRMED] | How soon a deleted voice's samples are purged | ElevenLabs support |
| [RESEND RETENTION TO BE CONFIRMED] | Plan and email data retention | Checklist item 6 |
| [STRIPE RETENTION TO BE CONFIRMED] | Stripe keeps records under its own legal obligations; confirm the account's data retention settings | Checklist item 7 |
| [AUTH LOG RETENTION TO BE CONFIRMED] | Supabase Auth audit log retention (follows the Supabase plan) | Checklist item 1 |

## Account checklist for Kevin

Readli doesn't change any provider setting automatically. Settings that could affect voice cloning are
changed only by hand, after a test clone.

1. **Supabase, plan and PITR.** Dashboard, Organization settings, Billing: note the plan. Project
   settings, Database, Backups: note the daily backup retention and whether Point in Time Recovery is
   enabled and its window. Public docs: Free has no backups, Pro 7 days, Team 14 days, Enterprise up to
   30 days. PITR is a paid add-on. Backups don't include Storage files.
2. **Supabase, log drains.** Project settings, Log Drains (paid plans): note whether any drain is
   configured and where it sends logs. Public docs give log retention of Free 1 day, Pro 7 days, Team 28
   days and Enterprise 90 days.
3. **Vercel, plan and Observability Plus.** Team settings, Billing: note the plan (Hobby, Pro or
   Enterprise) and whether Observability Plus is on. Public docs give runtime logs of Hobby 1 hour, Pro 1
   day and Enterprise 3 days, or 30 days with Observability Plus. Build logs are kept indefinitely.
4. **Vercel, log drains and crons.** Team settings, Log Drains (Pro and Enterprise): note any drain and
   its destination. After deploying, Project, Settings, Cron Jobs should list three
   `/api/cron/guest-cleanup` runs (05:00, 13:00 and 21:00 UTC) and `/api/cron/lifecycle` at 06:00 UTC.
   If the plan refuses more than one daily run per path, tell Claude: the 48-hour statement then needs
   a shorter demo session or different wording.
5. **ElevenLabs, plan, data-use toggle and agreements.** Sign in to the ElevenLabs web app with the
   account that owns the Readli API key, open the profile menu, then Settings, then the Data use section,
   and check that **"Improve the models for everyone"** is off (help article:
   https://help.elevenlabs.io/hc/en-us/articles/29952728805393). Readli has decided to opt out, but the
   app doesn't assume it's already off. Public docs say non-Enterprise accounts are opted in by default,
   and that the toggle affects model training only, not cloning or narration (inferred from the help
   article; confirm on the page). Also note the plan, whether a DPA is signed, and ask support how soon a
   deleted voice's samples are purged. Zero Retention Mode is Enterprise only and excludes voice cloning,
   so it isn't an option for Readli. Readli's own training rights from contributors are separate from
   anything ElevenLabs may do, and the Privacy Policy says so.
6. **Resend, plan and retention.** Settings, Billing: note the plan. Public docs give 30 days of email
   data on Free, Pro and Scale.
7. **Stripe.** Settings, Business, check that the account's legal entity and support details are right.
   Stripe keeps payment records under its own legal obligations; no setting shortens that.
8. **Google OAuth.** Google Cloud console, the OAuth consent screen used by Supabase Auth: check the app
   name, support email, privacy policy link (`https://readli.ai/privacy`) and that only email and profile
   scopes are requested.
9. **Loom.** The recording tips embed a Loom video. Loom may set its own cookies when it plays. Decide
   whether to keep the embed or link out instead.

## Data inventory (verified in the repository)

| Data | Where | Deleted | Retention claim status |
|---|---|---|---|
| Demo recording and generated demo audio | Supabase Storage `guest-recordings/{session}/` and `/previews/` | `/api/cron/guest-cleanup` three times a day deletes sessions whose 24-hour session has expired, plus every file in the session's folders | Verified by integration tests; normally within about 33 hours, under 48 even if one run fails |
| Demo voice clone | ElevenLabs | Same run, `DELETE /v1/voices/{id}` (404 counts as deleted). A clone whose record can't be saved is deleted at once | Verified in tests; ElevenLabs' own purge of samples **unverified** |
| Demo rows (session, assets, consent receipt, training session) | Supabase | Same run, after Storage and the clone; the session row cascades | Verified in tests (fake with the migrations' cascades) |
| Demo take saved to an account | Copied to `voice-recordings/{owner}/` under the account's agreement | Not touched by demo cleanup | Verified |
| Unkept account recordings (candidates) | Storage plus ElevenLabs | Same run, after 24 hours | Verified in tests |
| Account recordings, voices, households | Supabase, ElevenLabs | Lifecycle cron; destructive steps are dry runs unless their flags are on | Flags off |
| Purchased credits and Stripe account credit at final closure | Supabase lots, Stripe customer balance | Held with an admin exception unless `LIFECYCLE_CREDIT_FORFEITURE=on` | Flag off pending counsel |
| Payment, tax and refund records | Stripe and Supabase | Kept as the law requires | Stripe period **unverified** |
| Accounts and sign-in | Supabase Auth (email OTP, Google OAuth) | With the account | Auth log period **unverified** |
| Transactional email | Resend via `email_outbox` | Outbox rows kept as records; Resend's copy per its plan | Resend period **unverified** |
| Database backups | Supabase | Rolling, per plan | **Unverified** |
| Request and error logs | Vercel, Supabase | Rolling, per plan | **Unverified** |
| Product analytics | First-party `analytics_events` table | With the database | Verified; no third-party analytics |
| Monitoring and error tracking | None in the code (no Sentry, Datadog, PostHog or similar) | Not applicable | Verified; Vercel and Supabase logs are the only monitoring |
| Fonts | `next/font/google`, self-hosted at build | No runtime request to Google | Verified |

## Deletion jobs and retries

- Each guest's deletion runs in order: ElevenLabs clone, then Storage, then the rows. The session and
  asset rows hold the encrypted clone reference and storage keys, so they're deleted only after every
  earlier step succeeded. A failed clone deletion is marked `failed` on its asset row; a succeeded one is
  marked `deleted` so a retry doesn't call ElevenLabs again.
- Account candidates: the candidate row is deleted only after its clone and recording are gone. A failed
  discard tells the user to try again; the daily run retries stale ones.
- Any failure, backlog, or demo older than 48 hours makes the run return 500 and emails `ADMIN_EMAILS`
  once a day through the email outbox.
- Storage deletion uses the Supabase Storage API (`storage.from(bucket).remove`), which deletes the
  object permanently (no versioning or soft delete in Supabase Storage, per its docs).

## Legal items still open

- Purchased-credit forfeiture: counsel to confirm state prepaid-balance, gift-card, consumer-protection
  and unclaimed-property rules before `LIFECYCLE_CREDIT_FORFEITURE` is turned on. Until then held
  credits go to the admin queue. Household-data deletion and credit disposition are separate processes.
- Refunds: only duplicate charges, billing errors and legally required remedies (for example EU/UK
  withdrawal rights where they apply). No automatic refund on cancellation.
- Biometric and voice laws (BIPA in Illinois, CUBI in Texas, Washington's biometric law): counsel review
  of consent and retention wording. Third-party licensing stays off there and outside the US.
- Every legal page shows "Under legal review" until counsel signs off (`LEGAL_REVIEW_PENDING`).
