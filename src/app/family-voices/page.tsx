import type { Metadata } from "next";
import { ExplainerPage } from "@/components/marketing/ExplainerPage";
import { publicPageMetadata } from "@/lib/seo/site";

const TITLE = "Family Voices";
const INTRO =
  "A family voice is a parent, grandparent or loved one's own voice, recorded once so Readli can read storybooks aloud in it. It stays private, and the person who recorded it stays in charge.";

export const metadata: Metadata = publicPageMetadata({
  title: "Family Voices: storybooks read in a loved one's voice | Readli",
  description: INTRO,
  path: "/family-voices",
});

export default function FamilyVoicesPage() {
  return (
    <ExplainerPage
      path="/family-voices"
      eyebrow="For storytellers"
      title={TITLE}
      intro={INTRO}
      steps={[
        { title: "Record about a minute", body: "Read a short story aloud in your natural storytime voice. The words scroll for you, on a phone or computer." },
        { title: "Hear it and approve it", body: "Listen to a story in your voice. Only when you're happy with it does anyone else hear it." },
        { title: "Share with the families you choose", body: "Share with one household or several, like each of your grown-up children's families." },
        { title: "Parents choose who listens", body: "Each parent decides which of their children can hear you. Your voice starts switched off for every child." },
      ]}
      sections={[
        {
          heading: "Only your own voice",
          tint: "bg-coral/30",
          body: <p>People can only record their own voice. An invitation never lets anyone upload or copy someone else&apos;s.</p>,
        },
        {
          heading: "It reads the library, nothing else",
          tint: "bg-mint",
          body: <p>A family voice only reads the storybooks in the Readli library. Nobody can type in their own words for it to say.</p>,
        },
        {
          heading: "Free, however many families",
          tint: "bg-sunshine/60",
          body: <p>Readli Voice is free. You never pay to record your voice or share it, however many families you share with.</p>,
        },
        {
          heading: "Stop sharing any time",
          tint: "bg-lavender/70",
          body: <p>Stop sharing with any family whenever you like, and the voice comes off their children&apos;s lists. You can also ask us to delete it.</p>,
        },
      ]}
      liveToday={[
        "Recording your voice in about a minute",
        "Free Readli Voice accounts",
        "Sharing with one or more families",
        "Parent approval for each child",
        "Stopping sharing at any time",
      ]}
      comingSoon={["A longer recording option for voices that are hard to copy from one minute"]}
      related={[
        { href: "/help/voices-and-sharing/who-controls-my-voice", label: "Who controls my recorded voice?" },
        { href: "/help/voices-and-sharing/record-my-voice", label: "How do I record my voice?" },
        { href: "/help/recording-tips", label: "Tips for a better voice recording" },
        { href: "/grandparents", label: "For grandparents" },
        { href: "/parents/safety", label: "Family privacy & safety" },
      ]}
      cta={{ primary: { href: "/try", label: "Try your voice free" }, secondary: { href: "/how-it-works", label: "How Readli works" } }}
    />
  );
}
