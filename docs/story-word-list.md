# Story word list

Every word and phrase to look for in the public-domain story texts (`src/lib/library/texts/*.json`) before a book is added or narrated, and what to write instead. It brings together the outdated-language scanner, the hand edits already made to the 51 books, the narration rules, and new words found by scanning the whole library on 2026-11-04.

The scanner is still where the rules actually run. Sections 1 and 3 mirror `src/lib/content/language-check.ts` and `src/lib/content/narration-check.ts`. Section 4 lists words the scanner doesn't know yet, waiting on Kevin's call. Once a word is decided, add it to the scanner so `npm run scan:language` and the tests catch it too.

**Levels:** *change* means it never reaches children as written. *Review* means it's usually the old, harmless sense, so read the sentence and decide.

## 1. Words the scanner already flags

Kevin, 2026-10-22: every word the first full scan found was replaced, so no book has one of these today (`src/lib/content/language-review.ts` is empty).

### Words whose meaning turned sexual

| Look for | Level | Why | Write instead |
|---|---|---|---|
| puss, pussy, pussies, pussey | change | Now sexual slang | kitty (Cheshire Kitty) |
| cock, cocks | change | Now sexual slang | rooster; Cock Robin: Robin Redbreast; turkey-cock: turkey |
| slut, sluts | change | Once a kitchen drudge, now a sexual insult | Cinder-girl, or drop the nickname |
| tit, tits, tits-mouse, titmouse, titmice | change | Now sexual slang | a name without it (Tom Tiptoe-mouse) |
| dick, dicky, dickie, dickies | change | Now sexual slang | shirt-fronts, or another name |
| fag, fags, faggot, faggots, fagged | change | Now an anti-gay slur | bundle of sticks; tired out |
| ejaculate, ejaculated, ejaculation | change | Once "exclaimed", now sexual | exclaimed, cried out |
| intercourse | change | Once "conversation", now sexual | talk, friendship |
| erection | change | Now usually sexual | building |
| make love, made love, making love | change | Once "court", now sexual | courted, said sweet things to |
| spunk, spunky | change | Once "courage", now sexual slang | pluck, plucky |
| pecker | change | Now sexual slang | chin, spirits |
| boner | change | Now sexual slang | blunder |
| bonk, bonked | change | Now sexual slang | bump |
| dyke, dykes | change | Now an anti-gay slur | dike, embankment |
| harlot, whore, hussy, wench, strumpet | change | Sexual insult | girl, woman, or drop it |
| knocked up | review | Once "woke someone", now "pregnant" | woke up |
| fanny | review | Sexual slang in British English (fine as a name) | a different name |
| gay, gayer, gayly, gayety | review | Old sense is merry; children hear an identity word | merry, bright, cheerful |
| queer, queerly, queerness | review | Old sense is strange; children hear an identity word or a slur | strange, odd, curious |

### Racist or outdated words for peoples

| Look for | Level | Why | Write instead |
|---|---|---|---|
| the n-word and variants | change | Racist slur | remove or rewrite the passage |
| negro, negress | change | Outdated racial term | remove or rewrite the passage |
| darky, darkey, darkies | change | Racist slur | remove or rewrite the passage |
| colored man / woman / people / boy / girl / servant (and similar) | change | Outdated racial term | remove or rewrite the passage |
| pickaninny | change | Racist slur | remove or rewrite the passage |
| sambo, golliwog, coon, jigaboo, tar-baby | change | Slur or caricature | remove or rewrite the passage |
| jap, chinaman, coolie, gook | change | Anti-Asian slur | the nationality, or rewrite |
| redskin, red indian, injun, squaw, papoose | change | Slur or stereotype for Native Americans | remove or rewrite the passage |
| hottentot, kaffir, bushman, eskimo, gypsy, gyp, half-breed, half-caste, mulatto, quadroon, octoroon, blackamoor | change | Racist or outdated name for a people | a respectful name, or rewrite |
| jewed, jewing, yid, kike, dago, wop, spic | change | Ethnic slur | remove or rewrite the passage |
| mammy | review | Stereotype when used of a Black nurse or cook | the character's name |
| chink | review | Slur (fine as a crack in a wall) | crack, gap |
| oriental | review | Dated term for Asian people and places | Eastern, or drop it |
| indian, indians | review | Often a Native American stereotype in old books (fine for India) | check the sense; rewrite a stereotype (Raggedy Ann's "Indian doll" is a scout doll) |
| savage | review | Old books use it for non-European peoples (fine as fierce) | fierce, cross |
| heathen, barbarian, cannibal | review | Old books use it for non-European peoples | rewrite the comparison |
| slave, slavery | review | Check the context | servants, helpers |

### Disability words

| Look for | Level | Why | Write instead |
|---|---|---|---|
| cripple, crippled, midget | change | Hurtful word for disabled people | who couldn't walk; small |
| idiot, imbecile, moron, cretin, retard, spastic, mongol | review | Old medical labels, now insults | silly, foolish |
| lame | review | Dated word for a disabled person (fine for an animal's leg) | who couldn't walk, or the name (Heidi's Clara) |
| dumb | review | Old sense is unable to speak, now an insult | speechless, silent |
| lunatic, loony | review | Dated word for mental illness | silly, wild |

### Swearing

| Look for | Level | Why | Write instead |
|---|---|---|---|
| damn, goddamn, bastard, bitch, bugger, bloody, arse, shit, fuck, piss, crap | review | Swearing (bitch and bastard are fine only in their literal sense) | drop it or soften it |

## 2. Edits already made by hand

Keep these if a text is ever imported again. They come from Kevin's decisions recorded in `src/lib/library/texts/index.ts`.

**Words and names**
- Cinder-slut is Cinder-girl. Cock Robin is Robin Redbreast. Cock is Rooster, and Mother Holle's rooster crows "Doodle-doodle-doo!". Tom Tits-mouse is Tom Tiptoe-mouse. Cheshire Puss is Cheshire Kitty.
- Heidi's Hottentots are the "Land of Knots". "Lame" Clara is rewritten.
- queer becomes strange or odd. Field's garden is "dear", not "queer". gay becomes merry or bright.
- stupid becomes dull, dreary or foolish (in the 27 books added on 2026-10-23).
- Bobby Coon is Bobby Raccoon.
- Raggedy Ann: Dinah's description is rewritten, and the "Indian doll" is a scout doll. Uncle Wiggily's Thanksgiving loses its dated "Indians" exchange.
- A Child's Garden of Verses leaves out six poems with dated lines. Just So Stories keeps only its seven gentlest tales.

**Smoking, guns and tobacco**
- Santa has no pipe. Farmer Brown has no gun. Ginger and Pickles sells peppermints, not snuff. Lear's tobacco-pipe mast is a wooden spoon, and the Duck's cigar is gone.

**Violence**
- No book ends in violence. Goldilocks and The Three Little Pigs have gentler endings, and the first two pigs run away instead of being eaten.
- Sleeping Beauty's cook scolds the scullery boy instead of pulling his hair or boxing his ear.
- Bremen's robber is scared off by noise, not bitten, kicked or clawed. The Troll swims away from the Billy Goats Gruff.
- Aesop's milkmaid is courted. Uncle Wiggily's closing teasers are gone.

## 3. Lines the narration voice misreads

These aren't offensive. The voice model takes them literally and reads them badly. `narration-check.ts` flags them.

| Look for | Problem | Write instead |
|---|---|---|
| Words in CAPITALS ("TRIP, TRAP!", Pooh's signs) | Shouted, or spelled out letter by letter | normal case |
| "in a small / low / little wee voice", "in a whisper" | Narrator goes too quiet to hear | leave it out, or "as politely as he could", "a little more boldly", "cried" |
| A one- or two-word sound repeated as separate sentences | Becomes tiny separate clips | one line: "Caw, caw!", "Buzz, buzz, buzzz!", "Ha, ha!" |
| Runs of punctuation like "!!!!!!" or "?!?" | Read oddly | a single ! or ? |
| Pooh's misspelled notices | Hard to read aloud | spell them so a narrator can read them |

## 4. New words found on 2026-11-04 (Kevin's call)

I scanned all 51 books for words the scanner doesn't know. These are the ones that match a decision already made for other books, or that a parent might trip over. Counts are for the whole library.

| Look for | Where | Suggest | Why |
|---|---|---|---|
| stupid (12) | Alice (6), Heidi (2), The Emperor's New Clothes (4) | dull, foolish, silly. In the Emperor, "foolish or unfit for his office" | Kevin already changed stupid in the newer books. Add it to the scanner as *change*. |
| simpleton (10), ninny, dunce | Alice, The Queen Bee, The Ugly Duckling | silly, foolish | Same name-calling as stupid. *Review.* |
| pipe, tobacco, smoking (Heidi, 8) | Heidi's grandfather smokes a pipe; Heidi brings him tobacco | grandfather sits "with his hands on his knees" or whittles; the tobacco gift becomes something else (a warm scarf) | Matches Santa's pipe and the snuff edit. |
| hookah, smoking (Alice, 3) | The Caterpillar | Kevin's call: keep (it's iconic), or "sitting quietly" | Same rule as above, but it's a famous image. |
| gun, shot, shooting (The Ugly Duckling) | Hunters shoot the geese, "the water became red with blood" | "a great noise rang out, and the wild geese flew up", with no one shot | Matches "Farmer Brown has no gun" and the gentler-violence edits. |
| gun, shoot (Winnie-the-Pooh, 5) | Christopher Robin's popgun shoots the balloon | Kevin's call: keep (it's a toy, central to the story), or "pop the balloon" | A toy, but it's still "your gun". |
| gun, shoot (Raggedy Ann, 3) | The tin soldier offers to shoot the lock | keep (Raggedy Ann already says no), or "knock the key out" | Low risk. |
| spanked (5) | Heidi (1); Just So, Taffy's name "Small-person-without-any-manners-who-ought-to-be-spanked" (4) | "…who-ought-to-be-sent-to-bed"; Heidi: "had to be scolded" | Matches the scolding edit in Sleeping Beauty. |
| brandy, liquor, beer, wine | Alice "Brandy now" (1), Heidi "strengthening liquor" (1), The Golden Goose "sour beer" and wine (6+), Heidi wine at dinner (2) | water, tea, milk, lemonade | Same reasoning as tobacco. Dinner-table wine in Heidi can stay. *Review.* |
| Big Turk (Heidi, 5) | A bullying goat named after a nationality | Big Bully, or Big Boss | A people's name used as a bully's name. |
| crazy (4) | Alice, Heidi (2), The Ugly Duckling | silly, "out of your mind", "foolish" | Same idea as lunatic. *Review.* |
| invalid (3) | Heidi (Clara, 2), Five Peas | "the sick girl" or her name | Matches the "lame Clara" edit. |
| naked (1) | The Elves and the Shoemaker, "two pretty tiny naked Little Men" | "two tiny Little Men with no clothes on" | Kevin's call. It's the story's point (they get clothes), but parents may wince. |
| hugged to her breast (3) | Raggedy Ann (2), Heidi "pain shot through Heidi's breast" | "hugged her close", "heart" | Robins' breasts and the snow's breast stay. *Review.* |
| mistress (37) | Cinderella, Heidi, Raggedy Ann, Bremen, The Ugly Duckling | "lady of the house", "owner", "the little girl" | The old sense is "woman in charge", but the modern meaning is an affair. *Review.* |

Looked at and left alone: kill, death, die and blood in fairy-tale and Alice usage (the "no violent endings" rule covers endings); ugly and fat (The Ugly Duckling depends on "ugly"); God, prayer and church in Heidi and Andersen; "shut up" (always "closed in"); "tribe" in Just So; nuts, balls, bang, hump, come, kiss, seed and tool, which are all innocent here.

## Running the scan

```sh
npm run scan:language                # every book
npm run scan:language -- book.json   # one book being imported
```

It prints each flagged sentence with a suggestion and fails on any *change* word. The language and narration tests fail on any finding a book's review doesn't account for.

## Adding to this list

When Kevin decides on a word, add it to `LANGUAGE_TERMS` in `src/lib/content/language-check.ts` and to section 1 here. Fix the books in the same PR, or record a deliberate keep in `src/lib/content/language-review.ts`.
