# Design Revision 001 — Homepage visual backlog

**Received:** 2026-10-10, designer notes forwarded by Kevin
**Status:** Backlog. Kevin likes the current direction (especially the recording review screen on phone); these are notes to build toward, not an instruction to rebuild. Scheduled in the [build plan](amendment-001-plan.md) as the "Design pass" after Phase 2.
**References:** Sago Mini interactive site (https://2016.deuxhuithuit.com/en/project/sago-mini/), Lingokids (https://lingokids.com/). Study principles only; never copy artwork, characters, layouts or code.

## Pending asset swaps (from outside the build)

| Asset | Owner | Notes |
|---|---|---|
| Readli logo | **Done** 2026-10-10 | Character logo (Readi at rest) in the hero; simplified face icon in the header and favicon; listening logo for playback states. Files in `public/brand/` |
| Readi mascot | **Selected** (received 2026-10-10, [reference](design/readi-mascot-states.png)) | Open-book buddy: white pages on a coral cover, yellow bookmark ribbon, dot eyes, pink cheeks, small legs. Two states: **At rest** (eyes open, pages together; used everywhere nothing is playing) and **Listening** (eyes closed, pages fanned in sunshine/mint/sky, shown while a story plays, paired with a player bar on a deep plum panel). Needs SVG source files to replace `ReadiMascot.tsx`. Extra poses for guiding recording, books and invites to be drawn in the same style |
| Hero and use-case illustrations | Designer / illustrator | Original artwork; hero shows Readi in a storytelling world |
| Six book covers | Designer, after rights review | Original or rights-cleared art per edition (PRD F-05). No modern or Disney artwork |
| Family photos | Kevin | Only with signed model releases (Brief §2) |

## Backlog, in the designer's priority order

### 1. Complete the illustrations
**Section rewritten** 2026-10-10: "Three ways to listen" is now "Every family has a story. Every voice makes it special." with Kevin's copy and three original inline-SVG scenes (child hearing Grandma, family tree of selfie avatars, book with highlighted text and a narrator picker). The hero scene still needs illustrator artwork.

- Replace every abstract placeholder and empty colour block on the homepage with finished original artwork.
- Hero: Readi in an imaginative storytelling environment.
- "Three ways to listen": meaningful scenes (parent at bedtime, grandparent reading from afar, read-along).
- Done means no section still holds an empty illustration placeholder.

### 2. Interactive family tree (primary differentiator)
**Prototype built** 2026-10-10 (`src/components/home/FamilyTree.tsx`, example data in `src/lib/content/example-family.ts`): 8 grown-ups and 3 kids over three generations, tree and list views, a profile card per person with a demo action that sends nothing. Initials stand in for selfie avatars until there are photos with releases.

- Replace the three-row family-circle section with a real visual tree of connected circular selfie avatars.
- At least seven example members across generations: grandparents, parents, siblings, aunts, uncles, cousins.
- Each person shows a name and a status: **Voice ready**, **Invite to record**, **Invitation pending**. These map to the PRD F-04 card statuses (`ready_shared`, `not_invited`, `invited`).
- Explorable without signing up; selecting a person opens their profile and possible actions (listen, invite, etc.), demo-only.
- Mobile: touch panning plus an accessible list view as an alternative; keyboard navigable.
- Must stay honest: example family, clearly a demo, and relationship labels remain display-only (Amendment F-8).
- Visually prominent on the homepage.

### 3. Six-book demo as a bookstore
**First pass built** 2026-10-10: the six books stand on wooden shelves in a bookcase panel (three per shelf on desktop, two on phones), and the classics row sits on a shelf too.

- Replace coloured rectangles with high-quality covers (see asset swaps).
- Browsing should feel like a children's bookstore shelf, not a grid of cards.
- Keep the ungated recording flow and "hear this passage in your cloned voice".

### 4. Readi as a recurring guide
**Started** 2026-10-10: Readi now appears in the hero, beside the scrolling-script preview, guiding the family tree, in Meet Readi and in the final call to action. Poses for recording and invites still need artwork.

- Same character throughout, based on the selected design above: guiding recording, discovering books, inviting family.
- Use **At rest** on idle screens and **Listening** whenever audio plays (demo previews, player). The listening panel's player bar ("[Story title] · read by [Narrator]") is the reference for the demo narration player.
- Subtle animation (blink, bob, page flip) that switches off under reduced motion.

### 5. Visual hierarchy and composition
- Fewer repeated rounded cards and alternating pastel bands.
- Layered illustrated scenes, distinctive shapes, typography variation, playful section transitions, more considered spacing.
- Premium children's entertainment feel while staying fast on mobile.

### 5b. Kids player: narrator switching front and centre (designer, 2026-10-10)
Launch-critical (PRD F-06). Full requirements in the [plan, Phase 7](amendment-001-plan.md#phase-7--library-player-and-narrator-switching). Design points:
- Current narrator's selfie avatar is the most prominent control in the player.
- Tap avatar → visual selector of authorized family voices (avatars + names), not a settings menu or dropdown.
- Page stays visible while switching; Readi **Listening** state is the loader when new audio is generating.
- Auto-resume in the new voice at the same sentence.

### 6. Must not break
Free 60–120s voice demo; continuous scrolling teleprompter; six-book excerpt selection; account registration and invitations; family voice permissions; voice switching; mobile-first recording and selfie capture; Premium Voice upgrade path.

### Deliverables when the pass runs
- Updated homepage visuals and the interactive family-tree prototype.
- Desktop, tablet and mobile screenshots (the Playwright suite already captures 375 / 820 / 1440).

## What can be built before final artwork
The family-tree interaction, bookstore shelf layout, Readi placements and section composition can all be built with the current placeholder art and swapped to final assets without code changes. Final polish waits on the logo, mascot and illustrations above.
