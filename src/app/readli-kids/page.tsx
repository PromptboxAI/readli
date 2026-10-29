import type { Metadata } from "next";
import { ExplainerPage } from "@/components/marketing/ExplainerPage";
import { pricing } from "@/lib/content/pricing";
import { publicPageMetadata } from "@/lib/seo/site";

const TITLE = "Readli Kids";
const INTRO =
  "Readli Kids is where children listen. Each child has their own bookshelf and hears only the storytellers a parent has approved for them.";

export const metadata: Metadata = publicPageMetadata({
  title: "Readli Kids: a safe listening space for children | Readli",
  description: INTRO,
  path: "/readli-kids",
});

// Shows the plan limits an admin saved, so it renders per request.
export const dynamic = "force-dynamic";

export default async function ReadliKidsPage() {
  const P = await pricing();
  return (
    <ExplainerPage
      path="/readli-kids"
      eyebrow="For children"
      title={TITLE}
      intro={INTRO}
      sections={[
        {
          heading: "Part of Readli Family",
          tint: "bg-sky/60",
          body: (
            <p>{`Readli Kids isn't a separate account. It's the listening space inside Readli Family, with up to ${P.maxChildProfiles} child profiles and ${P.simultaneousListeners} children listening at once.`}</p>
          ),
        },
        {
          heading: "Only approved storytellers",
          tint: "bg-mint",
          body: <p>A child sees a storyteller only after that person shares their voice and a parent switches it on for that child. Children can&apos;t change the list.</p>,
        },
        {
          heading: "Switch voices mid-story",
          tint: "bg-sunshine/60",
          body: <p>Children can switch between their approved storytellers, and the story carries on from the same sentence. Listening again is always free.</p>,
        },
        {
          heading: "Stays on the child's side",
          tint: "bg-lavender/70",
          body: <p>Once a parent opens a child&apos;s bookshelf on a device, that device stays in Readli Kids. The parent area and the rest of the website stay out of reach until a grown-up signs in.</p>,
        },
      ]}
      liveToday={[
        `Up to ${P.maxChildProfiles} child profiles, each with their own bookshelf`,
        `${P.simultaneousListeners} children listening at the same time`,
        "Storytellers approved per child",
        "Switching voices without losing your place",
        "Kids Mode that keeps a device on the child's side",
      ]}
      comingSoon={["More books, added regularly"]}
      related={[
        { href: "/help/privacy-and-child-safety/parents-control-voices", label: "Can parents control which voices each child hears?" },
        { href: "/help/privacy-and-child-safety/are-family-voices-private", label: "Are family voices private?" },
        { href: "/books", label: "The Readli Library" },
        { href: "/parents/safety", label: "Family privacy & safety" },
      ]}
      cta={{ primary: { href: "/signup/family", label: "Start your family" }, secondary: { href: "/how-it-works", label: "How Readli works" } }}
    />
  );
}
