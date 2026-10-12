# Retention and provider configuration (2026-10-12)

Kevin's "Final Credit Refund, Data Retention and Provider Configuration Decisions" asked for an audit of
where Readli data lives and for how long. This records what the code does, what the providers' public
documentation says, and what still has to be confirmed in each account before launch. The Privacy Policy
shows each unconfirmed item as a highlighted `[... TO BE CONFIRMED]` marker until it is filled in.

Provider documentation was read through search excerpts of the providers' own pages on 2026-10-12, not
from the live pages, so check the wording there before relying on it.

## What the code does (verified in the repository)

| Data | Where | Deleted |
|---|---|---|
| Demo recording, preview audio | Supabase Storage `guest-recordings/{session}/` | Daily cron `/api/cron/guest-cleanup` at 05:00 UTC deletes sessions expired over 24h old, so within 48h of recording. It also deletes every file under the session's folders. |
| Demo voice clone | ElevenLabs | Same run, through `DELETE /v1/voices/{id}`. A clone whose record can't be saved is deleted at once. |
| Demo rows (session, consent, training session) | Supabase | Same run; the session row cascades. |
| Demo take saved to an account | Copied to `voice-recordings/{owner}/` under the account's agreement | Not touched by demo cleanup. |
| Unkept account recordings (candidates) | Storage plus ElevenLabs | Same run, after 24h. |
| Account recordings, voices, households | Supabase, ElevenLabs | Lifecycle cron; destructive steps are dry runs unless `LIFECYCLE_DELETION`, `LIFECYCLE_RECORDING_DELETION` and `LIFECYCLE_CLONE_RETIREMENT` are `on`. |
| Purchased credits and Stripe account credit at final closure | Supabase lots, Stripe customer balance | Held and an admin exception opened, unless `LIFECYCLE_CREDIT_FORFEITURE=on`. |
| Third-party analytics or log services | None in the code | Only first-party `analytics_events`. |

Demo cleanup alerts: a run with failures, a backlog, or any demo still present 24h after expiry (past
48h) returns HTTP 500 and emails `ADMIN_EMAILS` once a day through the email outbox.

## What the providers say, and what to confirm

| Provider | Public documentation | Confirm in the account |
|---|---|---|
| Supabase database backups | Free: no backups. Pro 7 days, Team 14 days, Enterprise up to 30 days. PITR is a paid add-on (7 days by default, longer windows available). Backups hold Storage metadata, not files. | Plan, and whether PITR is on and its window. Fill in "DATABASE BACKUP PERIOD". |
| Supabase Storage | Deleting an object is permanent; no versioning or soft delete. | Nothing. |
| Supabase logs | Free 1 day, Pro 7 days, Team 28 days, Enterprise 90 days. Log drains on paid plans. | Plan; whether any log drain is configured. |
| Vercel runtime logs | Hobby 1 hour, Pro 1 day, Enterprise 3 days; Observability Plus 30 days. Build logs kept indefinitely (no personal data expected). Log drains on Pro and Enterprise. | Plan; Observability Plus; any log drain. Fill in "LOG RETENTION PERIODS". |
| ElevenLabs | Non-Enterprise accounts are opted in to model training unless "Improve the models for everyone" is turned off; Enterprise is not trained on by default. Zero Retention Mode is Enterprise only, per request, and doesn't cover voice cloning. Deleting a voice is permanent, with no published timeline for the sample. History is kept by default. | Plan or contract; the data-use toggle; DPA; ask support how soon a deleted voice's samples are purged. Fill in "ELEVENLABS DATA-USE SETTING". Don't change settings that would break cloning without testing. |
| Resend | Email data kept 30 days on Free, Pro and Scale. | Plan. |

## Jurisdiction dependencies

- Purchased-credit forfeiture: counsel should confirm state prepaid-balance, gift-card and unclaimed-property
  rules before `LIFECYCLE_CREDIT_FORFEITURE` is turned on. Until then held credits go to the admin queue.
- Third-party licensing stays off in Illinois, Texas and Washington and outside the US, as before.
