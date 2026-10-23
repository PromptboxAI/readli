import type { Metadata } from "next";
import { FamilyJourney } from "@/components/home/FamilyJourney";
import { ThreeWaysToListen } from "@/components/home/sections";

export const metadata: Metadata = { title: "Design: Family journey | Readli", robots: { index: false } };

/** Temporary side-by-side for the journey mockup: the old block above the new one, to compare their heights. */
export default function JourneyComparePage() {
  return (
    <main>
      <div id="old-block">
        <ThreeWaysToListen />
      </div>
      <FamilyJourney />
    </main>
  );
}
