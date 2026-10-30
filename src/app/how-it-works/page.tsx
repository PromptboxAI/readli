import type { Metadata } from "next";
import { ExplainerPage } from "@/components/marketing/ExplainerPage";
import { pricing } from "@/lib/content/pricing";
import { publicLibrary } from "@/lib/library/public";
import { publicPageMetadata } from "@/lib/seo/site";

const TITLE = "How Readli works";
const INTRO =
  "Readli reads classic children's books aloud in the voices of the people your kids love. Here's how a family goes from one short recording to a whole shelf of stories.";

export const metadata: Metadata = publicPageMetadata({ title: `${TITLE} | Readli`, description: INTRO, path: "/how-it-works" });

// Shows the plan limits an admin saved, so it renders per request.
export const dynamic = "force-dynamic";

export default async function HowItWorksPage() {
  const P = await pricing();
  const books = publicLibrary();
  const ready = books.filter((b) => !b.comingSoon).length;
  const upcoming = books.length - ready;
  return (
    <ExplainerPage
      path="/how-it-works"
      eyebrow="How it works"
      title={TITLE}
      intro={INTRO}
      steps={[
        { title: "Start your family", body: `A parent creates a Readli Family account and adds their children, up to ${P.maxChildProfiles} on one plan.` },
        { title: "Invite your storytellers", body: "Invite grandparents, aunts, uncles and family friends, wherever they live. Sharing a voice is free for them." },
        { title: "Each storyteller records about a minute", body: "They read a short story aloud on their phone or computer, then choose to share their voice with your family." },
        { title: "You approve voices for each child", body: "Every newly shared voice starts switched off. You choose which storytellers each child can hear." },
        { title: "Prepare a book in a voice", body: `Pick a book and a storyteller. Readli Family includes ${P.monthlyCredits} narration credits a month for preparing stories, and replays are always free.` },
        { title: "Your kids listen", body: "In Readli Kids, each child picks a book and an approved storyteller, and can switch voices without losing their place." },
      ]}
      sections={[
        {
          heading: "Try it before you sign up",
          tint: "bg-sunshine/60",
          body: <p>Record yourself for about a minute and hear a classic story read in your voice, with no account. Your recording is deleted within 24 hours unless you choose to save it.</p>,
        },
        {
          heading: "Free for storytellers",
          tint: "bg-mint",
          body: <p>Readli Voice is free for anyone who records. The family that listens has the Readli Family plan, so a grandparent never pays to share their voice.</p>,
        },
        {
          heading: "Private by design",
          tint: "bg-lavender/70",
          body: <p>A child hears a storyteller only after both the storyteller and a parent approve. Family voices are never made public.</p>,
        },
        {
          heading: "A library of classics",
          tint: "bg-sky/60",
          body: <p>{`Fairy tales, fables, bedtime poems and chapter books, from under a minute to a few hours long. ${ready} books are ready today.`}</p>,
        },
      ]}
      liveToday={[
        "Trying your voice free, with no account",
        "Readli Family accounts for parents",
        "Free Readli Voice accounts for storytellers",
        "Readli Kids listening for children",
        `${ready} classic books in the library`,
      ]}
      comingSoon={[
        ...(upcoming > 0 ? [`${upcoming} more books on the way, with new ones added regularly`] : ["New books added regularly"]),
        "A longer recording option for voices that are hard to copy from one minute",
      ]}
      related={[
        { href: "/family-voices", label: "Family Voices: how storytellers record and share" },
        { href: "/readli-kids", label: "Readli Kids: where children listen" },
        { href: "/parents/safety", label: "Family privacy & safety" },
        { href: "/pricing", label: "Pricing" },
        { href: "/help/getting-started/readli-family-voice-kids", label: "Readli Family, Voice and Kids: what's the difference?" },
      ]}
      cta={{ primary: { href: "/try", label: "Hear a story in your voice, free" }, secondary: { href: "/signup/family", label: "Start your family" } }}
    />
  );
}
