# Legal wording review: Terms, Voice Agreement, Privacy Policy

Prepared for Kevin to forward to counsel, 2026-10-12. This is a drafting review by Claude, not legal advice. All three documents are still marked Draft. The changes listed below are in PR #53 (Voice Agreement version `voice-agreement-2026-10-12.2`).

## Part 1. Fixed in the wording

These were drafting problems: contradictions, circular references, vague terms and missing disclosures about how the product already works. No business policy changed.

| # | Problem a lawyer would flag | Where | Fix |
|---|---|---|---|
| 1 | **Contradiction on downgrades.** "Changing plan" said downgrades wait for the end of the paid term, while the Archive paragraph said they "take effect right away". | Terms §9 | The Archive paragraph now points to "Changing plan". |
| 2 | **No clear auto-renewal disclosure.** New York and California auto-renewal laws expect the Terms to say plainly that the plan renews automatically, that a trial converts to paid unless cancelled, and how to cancel online. | Terms §9 | Added a "Renewal and cancellation" paragraph that describes the existing Stripe behaviour, with online cancellation in billing settings or by email. |
| 3 | **Prices in the Terms with no precedence rule.** | Terms §9 | Added: if a price or credit amount differs from what checkout showed, the checkout governs. |
| 4 | **"Required" development rights contradicted the withdrawal right.** The rights were called "a condition of using Readli Voice", yet withdrawing AI training keeps the story voice working. | Terms §4 and §16, Agreement §3 | Reworded to "required when you set up Readli Voice; you can withdraw it later without losing your story voice". |
| 5 | **Circular reference.** Account deletion kept delivered stories "only as far as this Agreement and the law allow", inside the Agreement itself. | Agreement §8, Terms §16, Privacy §4 | Now: stories keep playing as Agreement §9 describes, unless the law requires their removal. |
| 6 | **The rule on prepared stories left out per-family unsharing.** Turning sharing off for one family hides its stories, but Agreement §9 and Terms §9 said they keep playing while the plan lasts. | Agreement §9, Terms §9 | Added the per-family exception. Action B is now named as pausing future narration rights. |
| 7 | **Vague revocation.** "Readli may block … access" did not say what actually happens. | Terms §6 | Now states that Readli stops new narration and access to prepared stories for that household or child. |
| 8 | **The retention period for raw audio was unclear and circular** ("kept under the contributor's agreement"). | Privacy §4 | Now: kept until the contributor deletes the recordings, voice or account. If AI-training permission was withdrawn, the recordings are also deleted 30 days after the last household that needs them is left without a plan. This matches the cleanup code. |
| 9 | **"For a while" is not a retention period.** | Privacy §4 voice models | Now 30 days, matching `cloneRetireAfterDays`. |
| 10 | **No duration for the license.** | Agreement §3 | Each right lasts until withdrawn under §8. |
| 11 | **Upgrade timing.** The Terms said "takes effect when you confirm", but the code applies the change only once payment succeeds. | Terms §9 | Now: "takes effect once that payment goes through". |
| 12 | **Credit returns missed action B.** | Terms §9 credits | Credits are now returned when a storyteller stops sharing as well as when they delete their voice. |
| 13 | **Hard to read.** A, B and C were run together in one paragraph in Terms §16. | Terms §16 | Each action now has its own labelled paragraph, with AI training and account deletion as separate items. |
| 14 | **Unspecified refund destination.** | Terms §9 | Refunds of unused paid time go to the original payment method. |

## Part 2. For counsel: legal risk needing advice

1. **Biometric privacy laws (Illinois BIPA, Texas CUBI, Washington RCW 19.375).**
   - Voiceprints and voice models can be biometric identifiers.
   - BIPA requires a public written retention schedule with a destruction deadline, plus a written release.
   - BIPA §15(c) also bars profiting from biometric identifiers, which puts the optional third-party licensing at risk for Illinois residents.
   - Ask counsel whether licensing should be geo-restricted, and whether recordings or derived embeddings are licensed.
2. **State privacy laws (CCPA/CPRA, Colorado, Connecticut, and others).**
   - Licensing recordings to other companies is probably a "sale".
   - That would need a notice at collection, sale disclosures and opt-out mechanics, and voice data counts as sensitive data.
   - Making Readli-development training a required consent at setup may not count as freely given consent in some states.
3. **New York voice and likeness law.**
   - Civil Rights Law §§50–51 requires written consent to use a voice for trade.
   - GOL §5-302 covers digital replica contracts.
   - §50-f covers post-mortem rights.
   - Ask counsel whether the Agreement needs a "reasonably specific description" of uses, especially for third-party licensing, and what happens to a voice after the contributor dies.
4. **Clone kept after the recordings are deleted (action A).** Is this allowed under ElevenLabs' terms and the laws in each state where Readli sells?
5. **Children.** Confirm the COPPA 2025 amendments, in particular the voice-recording exception and any written data-retention policy requirement.
6. **ElevenLabs data use (Privacy §8).**
   - Readli has to confirm its API data-use and model-training settings before launch.
   - Otherwise "demo and children's data are never used for training" could be untrue at the provider.
7. **Third-party licenses that survive withdrawal (Terms §16).** Counsel should check that this is disclosed prominently enough at the opt-in screen.
8. **Existing counsel notes, still open.**
   - Liability cap and exclusions (Terms §19).
   - Arbitration, class waiver and venue (Terms §20).
   - The effective dates to set at publication.

## Part 3. For Kevin: business decisions, wording left as is

These are flagged rather than changed, because each one sets policy.

1. **Unused purchased credits when a plan ends or an account is deleted.**
   - The current wording, "reviews any remaining paid balance", is vague.
   - Decide: refundable on request, kept indefinitely, or something else.
   - Check state prepaid and gift-certificate rules.
2. **A timeframe for refunds** of account credit and unused paid time.
3. **Price-change notice.** The Terms now say Readli tells customers before a price change applies to their plan. New York's auto-renewal law expects this. Confirm Readli will do it, and how far ahead.
4. **Trial reminder email.** Decide whether to send one before a trial converts to paid. It isn't legally required for a 14-day trial in most states, but it's best practice and lowers chargebacks.
5. **Contributor compensation.** Should the Agreement say plainly that contributors are not paid, including for optional third-party licensing?
6. **Third-party licensing scope.** Decide who the "other companies" can be, whether recordings are de-identified, and whether contributors are notified per license.
7. **Termination by Readli.** Decide whether a refund is owed when Readli suspends an account for a violation (Terms §17).
8. **Placeholders still in the Privacy Policy:**
   - `[VERIFIED PERIOD]`, `[BACKUPS]` and the other retention placeholders;
   - `[PROVIDER-LIST URL]`.
