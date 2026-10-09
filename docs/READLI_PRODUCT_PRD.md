# READLI FAMILY — Product Requirements Document v1.0
**Date:** 2026-10-09  
**Target implementation:** Claude Code, Next.js web/PWA, Supabase, ElevenLabs API  
**Product stage:** Acquisition-oriented family/kids MVP  
**Status:** Implementation specification with noted commercial/legal gates

## 1. Executive summary
Readli is a family-first digital library and voice-preservation product. Adults create and consent to private voice clones, invite relatives to join connected family circles, and use those voices to narrate rights-cleared classic books for parent-managed child profiles. Users can switch narrator mid-book and resume at the same text position. Homepage visitors can test a 60-second voice recording and immediately preview one of six public-domain passages without signing up. Readli's differentiated company assets are permissioned family relationships, licensed voices, engaged listeners, and aggregate listening/content insights, **not unrestricted sale of raw family voice or child data**.

Brand: `Readli` / intended `readli.ai`; social handle target `@readliai`. Consumer taglines: **Every Book. Every Voice.** / **Their favorite stories. Read by their favorite people.** Audience: adults/parents and family circles, kids supervised. Strategic exit path: operational business with strategic integration potential for publishers/distributors such as RBmedia, not a guaranteed buyer.

## 2. Objectives and boundaries
### Goals (measure, don't assume)
- Let any adult experience a high-quality, consented, ungated voice-clone demo on a phone in a few steps.
- Ship six approved story samples; curate initial 20–30 fully rights-cleared children’s editions for read-along; generate audio incrementally based on permitted access.
- Make invitations, private voice access, and repeat story listening intuitive.
- Verify the hypothesis that recognizable family voices drive family referrals and repeated sessions; track consented and privacy-preserving funnel metrics.
- Enable publisher/voice marketplace expansion later without reworking identity/entitlement infrastructure.
### Not in first release
- Public voice marketplace or payouts; full professional voice-clone marketplace; self-service ad network; mobile-native apps; paid audiobook deals; child accounts with independent logins; indiscriminate scraping of Gutenberg; universal ebook DRM circumvention; guaranteeing eternal voice availability; unconstrained unlimited anonymous synthesis.

## 3. User roles and ownership
- `guest`: anonymous adult on temporary signed demo session; may consent to short recording and limited preview; no permanent voice ownership until enrollment.
- `adult`: authenticated verified email account; profile, selfie/avatar; individual owner of own consented voice(s).
- `circle_admin`: adult can invite/remove members, manage child listening profiles and circle plan; cannot override other adults' voice permissions.
- `circle_member`: adult with accepted membership; access only expressly granted voices/content.
- `child_profile`: subordinate parent-managed profile with nickname/icon, preference/bookmark data minimum needed; no email, login or voice cloning.
- `narrator_applicant`: future expansion, must separately opt in to public discovery/royalties and high fidelity verification.
- `publisher_admin`: future role; license scope for approved titles/voices.
- `platform_admin`: limited privileged operations; audited sensitive access.

## 4. Mandatory customer journeys
**J1 Guest demo:** home → consent / adult confirmation → mic test → record 60 sec → review take → clone creation/verification as permitted → 6-book selector → choose passage → play in guest's synthesized voice → optional signup to save. No login gate for the preview. If provider forbids anonymous IV cloning, use an honest configuration-specific limitation or obtain approved integration; never fake cloning.

**J2 Signup & voice persistence:** demo success → email signup → verified session → explicit updated consent to persist sample, voice clone, and selected usage rights → bind guest assets with one-time token and reauthorize / recreate if necessary → delete unclaimed guest data on TTL.

**J3 Family invitation:** parent creates circle → `Invite Grandma` email/share link → invitee creates own account → identity/voice-owner consent → records her own voice → explicitly grants named circle permission → family sees voice in selector. Pending invite never acts as permission.

**J4 Parent-mediated child listening:** parent selects child profile → public-domain book → authorized family narrator → play and read along → bookmarks → switch to another authorized narrator → resume at same canonical sentence position, with a short boundary transition if necessary.

**J5 Permission removal:** owner revokes access to family circle → immediately block NEW generations/playback authorization and purge cached entitlements; policy for already generated files defined in the voice agreement; audit revocation and asynchronous file lifecycle.

**J6 Legacy:** adult can opt in to specific posthumous policies only with reviewed contract (no use/finished audio only/new private generations by named designees); default is NO posthumous new synthesis. Implementation behind feature flag until legal/provider clearance.

## 5. Feature specifications / acceptance criteria
### F-01 Home and demo (P0)
- Functional guided recorder in Chrome Android, Safari iOS, desktop Chrome/Edge/Safari, with appropriate codec fallbacks.
- No account/email/paywall required before generating a preview; verified adult affirmation and specific recording/AI processing consent required.
- Guest audio NOT used to train Readli models or published; never cloned from uploaded third-party samples in demo.
- Display real recording duration, waveform, audio preview, and retake; reject silent/clipped/noisy/too-short samples with actionable feedback. Target 60–90s; quality over fixed time.
- Exactly six sample book cards visible directly below recorder. Each has preapproved 30–45s canonical passage. Selection requests actual generation for available voice; only one concurrent generation/session and bounded trial generation count (default 1 generation + 1 retry, configurable).
- Show honest queue/pending/failure states and approximate output only if measured; timeout returns retry or approved fallback, not counterfeit preview.
- Guest session limited by quotas, expiry (proposed ≤24h for recording and associated clone; define short transient logs), bot controls and cost kill switch; supplier/provider deletion requests tracked.
- Fallback sample in generic voice must clearly identify that it is NOT the visitor's clone.

### F-02 Account, selfie and privacy (P0)
- Adult sign-up via email OTP/passwordless (or secure password). Verify email, session management, export/delete, unsubscribe and marketing preference separate from ToS.
- Record user's chosen display name; optional camera selfie (not required). On mobile support front-facing camera/photo upload with size/type validation, cropping, opt-in publication status (private by default), no facial recognition needed. Strip unnecessary EXIF/GPS. Only public narrator avatars exposed publicly with permission.
- Minimize parent profile collection: no child full names, birthdates or voice biometrics for MVP; child nickname and coarse age band optional.

### F-03 Voice studio, authority and scopes (P0)
- Consent captured with immutable policy version, purpose, timestamp, owner user ID, accepted fields, IP minimized/audited, voice recording ID/provider ID, explicit scope.
- Guided script modules and quality checks; instant voice only via supported provider flow with legitimate verification. 1–2 minutes recommended. Do not infer legal consent solely from clicking general Terms.
- Account may have multiple voice profiles only for self/approved authorized scenarios; do not create other-person clones from uploaded recordings. UI displays owner and avatar.
- Permission scopes: `self`, `circle:<id>`, `specific_users`, `public_opt_in` (future). Never auto-promote private voice to public based on recording length.
- Professional voice: separate guided 30–180min recording series with resumability/verification and optional paid setup; launch gated behind feature flag until ready.
- Voice owner can revoke sharing and request deletion; disclose outputs already created and provider limitations accurately.

### F-04 Family circles and invitations (P0)
- Adult users may belong to multiple circles; invitation token hashed, scoped, signed, single-use/expiring; accepted membership never grants voice permissions automatically.
- Card statuses `not_invited`, `invited`, `joined_no_voice`, `recording`, `pending_verification`, `ready_shared`, `revoked`.
- Invitation via email plus native share or copy link; rate limits, unsubscribe/abuse protection; no unauthorized contact scraping.
- Relationship labels are display only (Mom, Dad, Grandpa, etc.), not proofs of kinship.
- Separate `voice_grants` table with grantor = voice owner, grantee principal and scoped purpose; server enforces on each request. Child accounts represented by caregiver authorizations.

### F-05 Public-domain catalog (P0)
- Import approved text and metadata via Project Gutenberg authorized catalog/bulk routes, with per-edition copyright review. Store provenance URL, publication/translation/illustrator, public-domain decision and territory; enforce availability by jurisdiction.
- Six home samples: Peter Rabbit; Benjamin Bunny; Wizard of Oz; Alice in Wonderland; Peter Pan: Peter and Wendy (1911 novel, Gutenberg #16); Winnie-the-Pooh (1926 original, Gutenberg #67098).
- Initially list 20–30 curated kids editions by story duration, age band, theme, and read-along suitability. Do not claim all Gutenberg content safe for all children.
- Text, illustrations, translation rights reviewed separately; do not copy modern audiobook recordings or contemporary cover designs.
- Private uploads: defer to P1; eventually accept EPUB/TXT/DOCX from adults who warrant appropriate rights; private-only by default, no public search/indexing, moderation, delete/export.

### F-06 Generation, player and narrator switch (P0)
- Generate chapter / natural sentence segment units with ElevenLabs adapter; stable `edition_id`, `chapter_id`, `canonical_segment_id`; store voice, model, text hash, provider call cost, output assets and aligned timestamps when reliably available.
- Voice switch during playback uses semantic/canonical sentence ID rather than bare wall-clock time. Pause → choose authorized voice → map passage to target voice → obtain/generate corresponding segment → resume at same/nearest sentence boundary; show processing indicator if non-pre-rendered voice; no guarantee of zero-latency on first new voice.
- Guest snippet can start at intro passage; authenticated read-along page supports illustration + plain text + chapter navigation, speed, bookmarks, device persistence and sleep timer.
- Audio streaming requires time-limited signed URLs and ongoing server-side entitlement checks. Never expose ElevenLabs API keys or reusable provider voice credentials client side.
- Audio cache keys include text edition hash, voice ID, provider model/version, generation parameters; cache by scope and contract, not across unauthorized circles.

### F-07 Billing, usage, ads (P1)
- Plans are configurable (free demo cap, family monthly included minutes/characters, paid upgrade, premium private clone setup); pricing TBD, do NOT hardcode illustrative prices.
- Server ledger of generated characters, play minutes, job status, provider cost estimate, billing unit, refunded jobs; reservation and actual charge logic to avoid duplicate job charges.
- Future payment gateway Stripe including webhooks, subscription state and entitlements.
- P0 kids space: no targeted ads, behavioral advertising or audio interruption. P1 considers contextual, parent-facing sponsorship only after legal/consent assessment. Do not presume acquirer can monetize children's personal data freely.

### F-08 Measurement and acquisition-readiness (P0)
Track first-party privacy-reviewed events for adult sessions: `landing_view`, `demo_consent_accept`, `mic_permission`, `record_start`, `record_success`, `clone_start`, `clone_success`, `sample_book_select`, `preview_play`, `signup_after_preview`, `circle_create`, `invite_send`, `invite_accept`, `voice_grant`, `listen_start`, `listen_qualified`, `narrator_switch`, `resume_after_switch`, `book_complete`, `voice_revoke`, `trial_spend`.
- Consent and analytics separated. Avoid child-level behavioral advertising or unnecessary child profiling.
- Admin dashboard: adult MAU/WAU, return rates, successful clones, guest-to-signup, invite conversion, active circles, 7/30d retention, narrators used, switch continuation, listening hours, cost per preview, synthesis costs and failure rates. Acquisition deck must display accurate denominators and cohorts.

## 6. Suggested relational schema (Postgres)
Use UUID PKs, `created_at` / `updated_at`, FK constraints, unique and partial indices, RLS policies and auditable privileged actions. Names indicative; engineer may refine migrations with approval.

**Core:**
- `users` (auth.users reference), `adult_profiles` (display_name, avatar_asset_id, email_verification, marketing_preference), `child_profiles` (guardian_id, nickname, age_band, icon, deleted_at), `circles` (owner_id, name), `circle_memberships` (circle_id, user_id, role, accepted_at, revoked_at), `circle_invitations` (circle_id, inviter_id, hashed_token, recipient_email_hash, relationship_label, expires_at, accepted_at).
- `voice_profiles` (owner_id, scope_default=self, display_name, avatar_id, clone_type=instant|professional, provider, provider_voice_id encrypted/restricted, status), `voice_samples` (voice_id, storage_path, duration_ms, deletion_state), `voice_consents` (owner_id, voice_id, policy_version, purposes, recording_proof_ref, captured_at, revoked_at), `voice_grants` (voice_id, granted_by, principal_type, principal_id, can_generate, can_play, expires_at, revoked_at), `voice_legacy_policies` (voice_id, option, designates, terms_version; OFF by default).
- `books` (title, author, year, subject, age_band), `book_editions` (book_id, source, text_uri, translation, jurisdiction, rights_status, provenance_url, reviewed_by, reviewed_at), `chapters` (edition_id, ordinal, title), `canonical_segments` (chapter_id, ordinal, normalized_text, text_hash, length), `illustrations` (edition_id, attribution, rights_status, asset_url), `demo_passages` (edition_id, start_segment_id, end_segment_id, approved_at).
- `generation_jobs` (owner or guest_session_id, voice_id, edition_id, range, request_hash, status, character_count, cost_estimate, cost_actual, retries, provider_request_id), `narration_assets` (generation_job_id, voice_id, segment_range, storage_key, waveform/alignment metadata, expires_at, revoked_at), `playback_progress` (profile principal, edition_id, segment_id, offset_ms), `listening_sessions` (adult account/circle/context, book edition, duration, mode), `voice_switch_events` (session_id, from_voice_id, to_voice_id, segment_id, continued_at).
- `guest_sessions` (signed_id_hash, consent_receipt_id, quota, expires_at), `guest_assets` (session_id, recording/blob/clone pointers, expiry, deletion_state), `consent_receipts` (actor_id or guest session, version, purpose, given_at, revoked_at), `usage_ledger`, `audit_logs`, `analytics_events` (no audio or child raw biometrics), `admin_feature_flags`, `provider_cost_events`.

**Critical RLS examples:** voice owner can view/manage own voice and grants; circle members can see only metadata explicitly shared; playback API always checks valid grant and content entitlement; no guest/admin public listing of private voice/provider IDs; child data accessible only to guardian; logs and provider IDs kept server-side. Test cross-circle and revoked-user isolation.

## 7. API contract sketch (Next.js handlers, server only)
- `POST /api/guest/session` issue signed scoped TTL token after affirmative demo-processing consent.
- `POST /api/guest/recording` upload signed short recording, verify MIME/duration/rate; write private temporary object.
- `POST /api/guest/clone` reserve quota, validate owner/live verification where supported, enqueue provider clone job.
- `GET /api/guest/jobs/:id` poll status; own guest session only.
- `GET /api/demo/books` six rights-cleared cards and approved passage metadata.
- `POST /api/demo/generate` selected book + guest clone, enforce session/quota/rights, generate short segment.
- `POST /api/auth/claim-guest-voice` authenticated user, explicit persistence consent, validated guest association.
- `POST /api/voices/recordings`, `/api/voices/create`, `/api/voices/:id/grants`, `/api/voices/:id/revoke` with user-specific RLS and provider sync.
- `POST /api/circles`, `POST /api/circles/:id/invitations`, `POST /api/invitations/accept`.
- `GET /api/library`, `GET /api/books/:editionId/chapters`, `POST /api/narrations/request`, `POST /api/playback/switch`, `PUT /api/playback/progress`.
- `GET /api/admin/metrics` protected through explicit admin role and audit.
All state-changing routes use CSRF/session checks as appropriate, strict input schemas, idempotency keys, request ownership tests, and bounded job retries.

## 8. Service architecture
Frontend: Next.js App Router + TypeScript, Tailwind with custom token CSS variables and reusable components, PWA manifest and service worker carefully scoped to non-sensitive public assets.
Backend: Supabase Auth, PostgreSQL with RLS, private object storage and signed URLs. Durable queue (e.g. Trigger.dev/Inngest/Redis workers depending deployment) for generation, cleanup, transcript alignment, email sends, provider sync. A `VoiceProvider` adapter wraps ElevenLabs clone/verify/generate/delete and allows future provider substitution without exposing to UI.
Messaging: transactional invitation/verification emails via provider; no promotional mail without permission.
Audio pipeline: ingest/edit normalized public-domain text; chapter segments; synthesis; alignment metadata; transcoding with loudness QA; private storage; playback via expiring signed URLs. Use provider timeout backoff, circuit breaker, per-user budgets and region-specific privacy review.
Storage split: private voice samples and clones metadata vs public-domain text and illustration metadata; retention and deletion orchestrator; encryption at rest and in transit; secrets server only.

## 9. Vendor / legal launch gates (must be tested, not assumed)
1. ElevenLabs commercial agreement must permit guest clone flow and family account usage via our service; their standard documentation states Instant Voice Clones can't be externally shared as ElevenLabs voice assets, but Readli need not share the underlying clone across independently owned ElevenLabs accounts if the enterprise/service arrangement permits private streaming. Obtain written interpretation covering account/workspace scope, authentication/verification, generation, cached audio, deletion and posthumous use.
2. Verify supported voice-owner live verification in the integration; no user can clone another person's voice based only on uploaded audio/avatar. Record affirmative, versioned consent.
3. Children's data and parental management: COPPA/FTC, state biometric laws, marketing consent, deletion and privacy by design. Children's listening data is not a transferable unrestricted advertising dataset. Privacy and legal counsel sign-off required.
4. Each public-domain edition is separately rights reviewed, including illustrations and translations, and restricted by territory if needed.
5. Staff access and incident controls: security audit, penetration test, recording encryption, breach playbook, moderation, accessible deletion/export.
6. No claim that professional cloning is instantaneous: provider docs say professional clones can take multiple hours.

## 10. System states and failures
Guest clone failed, microphone denied, quota exhausted, wrong input codec, suspicious sample, voice verify rejected, generation slow, passage not cleared, voice revoked during chapter, family invite expired, provider outage, storage outage, user deletes account during queue processing. Each gets a real user-facing error + retry or safe exit. Cancel generation and avoid charging uncompleted work where possible. Every error tracked without unnecessary personal audio.

## 11. Security/privacy threat model
- Impersonation: active self-verification, no uploading third-party celebrity/deceased voice without independently verified authorization; fraud review; impossible to alter voice owner using client payload.
- Unauthorized cross-circle access: service-side entitlement checks, RLS with negative tests, short-lived signed asset URLs, revocation cache invalidation.
- Demo abuse: per guest spend caps, token expiry, IP throttling, bot challenges on suspicious activity, queued concurrency and global budget kill switch.
- Biometric/recording sensitivity: least access, clear policies, limited storage, separate analytics, auditable deletion, do not train Readli models on user recordings.
- Young listeners: guardian-owned profiles, age-appropriate content, parent gate, no child-directed targeted ads or marketing profiles.
- Copyright: approved catalog ingestion; no audiobook piracy, DRM bypass or uncontrolled distribution of private user-uploaded works.

## 12. Success metrics and proposed pilot thresholds (hypotheses)
- Guest demo completion: measure recording starts → actual successful audio output, and failed permission rate. Initial target >50% of completed valid recordings yield played preview, revisable after baseline.
- Guest→account: target 15–25% after successful preview (hypothesis).
- Family invite acceptance within 14d: target 25% (hypothesis).
- First family voice creation within 14d after signup: target 20% (hypothesis).
- Repeat weekly family listening: measure 7/30d cohorts, not only total traffic.
- Cost ceiling per demo: budget flag; calculate from actual ElevenLabs call logs before public scale.
- Presentation metrics: active adult accounts/family circles, consenting voices, referral coefficient, listening engagement, retention and provider costs—only real observed data.

## 13. Implementation milestones
**Phase 0 — Experience system:** original Readli design tokens, site nav, hero, illustrated placeholder mascot style, responsive homepage, six real provenance-tagged sample book cards, interactive *clearly mock-labeled* recording/player screen; screenshot/UX approval before API integration.
**Phase 1 — Functional guest demo:** voice provider sandbox / paid account, real mobile recording, consent receipt, microphone checks, provider IVC, one selected real sample synthesis, playback, quotas, TTL cleanup, cost monitoring and e2e tests. This is the *first must-work vertical slice*.
**Phase 2 — Families:** Supabase Auth, profile and optional selfie, family circles/invites, owner grants, voices, parent-managed child profiles, email invites, revoke/delete and policy tests.
**Phase 3 — Full kids library:** approved 20–30 editions, rights ingestion, text/illustration view, audio production queue, caching and canonical-position voice switching, cross-device resume, basic admin.
**Phase 4 — Launch & evidence:** analytics dashboard, privacy review, accessibility/performance QA, referrals, controlled beta 50 families, engagement dashboards, buyer demonstration package.
**Later:** private book upload; pro narrator recording and royalties; contextual parent-facing sponsorships; payments; publisher console.

## 14. Functional acceptance tests (minimum)
- [ ] Guest completes consent → records → selects one of SIX story passages → hears own actual generated voice without account on Safari iOS and Chrome Android.
- [ ] If consent unchecked, cannot record/upload/clone. Recording denied shows retry guidance.
- [ ] No more than permitted guest renders even with duplicate clicks/race conditions.
- [ ] Guest data expires and supplier-delete jobs are audited; no forgotten clones.
- [ ] Two family circles with separate voice grants cannot see or synthesize each other's private voices.
- [ ] Invitation alone cannot create or authorize a voice; invitee verifies identity and owns consent.
- [ ] Selfie upload is optional; no automatic public avatar or face recognition.
- [ ] Parent can manage child listening profile; child cannot open billing/voice privacy controls.
- [ ] Narrator switch resumes at same canonical sentence or documented nearest boundary in equivalent edition and does not silently jump to beginning.
- [ ] Revoking voice grant blocks unauthorized playback/generation immediately; cleanup queue begins.
- [ ] All demo books are backed by approved provenance+passage records; no uncleared covers.
- [ ] Accessible navigation, reduced motion, no audio autoplay, touch controls, screen reader names.
- [ ] Buyer-facing dashboards compute events from genuine server evidence, not inflated client-only clicks.

## 15. Developer work order for Claude Code
1. Inspect repository. Create `docs/decisions.md` with implementation uncertainties and vendor gates. Never invent approved contracts.
2. Implement typed domain model and architecture diagram. Generate SQL migrations/RLS and unit tests for roles/grants.
3. Build responsive original visual system to match DESIGN BRIEF; screenshot tests at 390 / 820 / 1440 widths.
4. Seed six rights-reviewed *placeholder metadata until approval*, and feature flag audio until genuine approved passages/assets available.
5. Implement guest demo end-to-end behind sandbox spend cap, consent, and provider adapter; no pretend success.
6. Implement account registration, one-way guest claim, invitation flows, voice permissions and mobile selfie capture.
7. Implement generation/reader/voice switching; use stable canonical segment mapping.
8. Build admin costs/analytics, deletion jobs, security review and measurable beta onboarding.
9. At every phase provide test results, remaining contract blockers and deployment instructions.

## 16. Official sources / verification links (review at build time)
- ElevenLabs voice cloning: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning
- ElevenLabs instant clone API: https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/instant-voice-cloning
- ElevenLabs voice sharing: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice
- ElevenLabs commercial TTS rights: https://elevenlabs.io/docs/overview/capabilities/text-to-speech
- Project Gutenberg: https://www.gutenberg.org/ and https://www.gutenberg.org/policy/permission.html
- FTC COPPA guidance: https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- Sago Mini visual inspiration: https://2016.deuxhuithuit.com/en/project/sago-mini/
- Lingokids visual inspiration: https://lingokids.com/

---
**Product-level non-negotiable:** Readli owns its experience, consent records, user relationships and analytics. Users own and authorize their voice likeness under defined licenses; no implicit transfer or resale of family voice models. Source technology remains supplied through compliant third-party API contracts.
