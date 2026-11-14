import type { Metadata } from "next";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { ACCESSIBILITY_EFFECTIVE_DATE, ACCESSIBILITY_INTRO, ACCESSIBILITY_SECTIONS } from "@/lib/content/accessibility";
import { publicPageMetadata } from "@/lib/seo/site";
import { PAGE_TITLES } from "@/lib/seo/titles";
import { PageLd } from "@/components/seo/PageLd";

export const metadata: Metadata = publicPageMetadata({
  title: PAGE_TITLES.accessibility,
  description: "How Readli approaches accessibility and how to ask for help.",
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return (
    <>
      <SiteHeader />
      <PageLd path="/accessibility" title={PAGE_TITLES.accessibility} description={metadata.description} />
      <PolicyDocument
        title="Accessibility Statement"
        effectiveDate={ACCESSIBILITY_EFFECTIVE_DATE}
        intro={ACCESSIBILITY_INTRO}
        sections={ACCESSIBILITY_SECTIONS}
      />
      <SiteFooter />
    </>
  );
}
