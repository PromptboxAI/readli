# Design Revision 001 — Homepage visual backlog

**Received:** 2026-10-10, designer notes forwarded by Kevin
**Status:** Backlog. Kevin likes the current direction (especially the recording review screen on phone); these are notes to build toward, not an instruction to rebuild. Scheduled in the [build plan](amendment-001-plan.md) as the "Design pass" after Phase 2.
**References:** Sago Mini interactive site (https://2016.deuxhuithuit.com/en/project/sago-mini/), Lingokids (https://lingokids.com/). Study principles only; never copy artwork, characters, layouts or code.

## Pending asset swaps (from outside the build)

| Asset | Owner | Notes |
|---|---|---|
| Readli logo | Kevin's designer, in progress | Replaces the placeholder wordmark in `src/components/brand/Wordmark.tsx` and the favicon |
| Final Readi mascot | Designer | One selected Book Buddy design, reused everywhere. Replaces `ReadiMascot.tsx`. Poses needed: idle, waving, listening (recording), pointing (books), holding an envelope (invites), celebrating |
| Hero and use-case illustrations | Designer / illustrator | Original artwork; hero shows Readi in a storytelling world |
| Six book covers | Designer, after rights review | Original or rights-cleared art per edition (PRD F-05). No modern or Disney artwork |
| Family photos | Kevin | Only with signed model releases (Brief §2) |

## Backlog, in the designer's priority order

### 1. Complete the illustrations
- Replace every abstract placeholder and empty colour block on the homepage with finished original artwork.
- Hero: Readi in an imaginative storytelling environment.
- "Three ways to listen": meaningful scenes (parent at bedtime, grandparent reading from afar, read-along).
- Done means no section still holds an empty illustration placeholder.

### 2. Interactive family tree (primary differentiator)
- Replace the three-row family-circle section with a real visual tree of connected circular selfie avatars.
- At least seven example members across generations: grandparents, parents, siblings, aunts, uncles, cousins.
- Each person shows a name and a status: **Voice ready**, **Invite to record**, **Invitation pending**. These map to the PRD F-04 card statuses (`ready_shared`, `not_invited`, `invited`).
- Explorable without signing up; selecting a person opens their profile and possible actions (listen, invite, etc.), demo-only.
- Mobile: touch panning plus an accessible list view as an alternative; keyboard navigable.
- Must stay honest: example family, clearly a demo, and relationship labels remain display-only (Amendment F-8).
- Visually prominent on the homepage.

### 3. Six-book demo as a bookstore
- Replace coloured rectangles with high-quality covers (see asset swaps).
- Browsing should feel like a children's bookstore shelf, not a grid of cards.
- Keep the ungated recording flow and "hear this passage in your cloned voice".

### 4. Readi as a recurring guide
- Same character throughout: guiding recording, discovering books, inviting family.
- Subtle animation (blink, bob, page flip) that switches off under reduced motion.

### 5. Visual hierarchy and composition
- Fewer repeated rounded cards and alternating pastel bands.
- Layered illustrated scenes, distinctive shapes, typography variation, playful section transitions, more considered spacing.
- Premium children's entertainment feel while staying fast on mobile.

### 6. Must not break
Free 60–120s voice demo; continuous scrolling teleprompter; six-book excerpt selection; account registration and invitations; family voice permissions; voice switching; mobile-first recording and selfie capture; Premium Voice upgrade path.

### Deliverables when the pass runs
- Updated homepage visuals and the interactive family-tree prototype.
- Desktop, tablet and mobile screenshots (the Playwright suite already captures 375 / 820 / 1440).

## What can be built before final artwork
The family-tree interaction, bookstore shelf layout, Readi placements and section composition can all be built with the current placeholder art and swapped to final assets without code changes. Final polish waits on the logo, mascot and illustrations above.
