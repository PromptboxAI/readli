import type { Metadata } from "next";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { TERMS_EFFECTIVE_DATE, TERMS_INTRO, TERMS_SECTIONS } from "@/lib/content/terms";
import { publicPageMetadata } from "@/lib/seo/site";
import { PAGE_TITLES } from "@/lib/seo/titles";
import { PageLd } from "@/components/seo/PageLd";

export const metadata: Metadata = publicPageMetadata({
  title: PAGE_TITLES.terms,
  description: "The terms for using Readli, including how private family voices and parent approvals work.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <PageLd path="/terms" title={PAGE_TITLES.terms} description={metadata.description} />
      <PolicyDocument
        title="Terms of Service"
        effectiveDate={TERMS_EFFECTIVE_DATE}
        intro={TERMS_INTRO}
        sections={TERMS_SECTIONS}
      />
      <SiteFooter />
    </>
  );
}
