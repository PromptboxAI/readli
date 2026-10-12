import type { Metadata } from "next";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { TERMS_EFFECTIVE_DATE, TERMS_INTRO, TERMS_SECTIONS } from "@/lib/content/terms";

export const metadata: Metadata = {
  title: "Terms of Service | Readli",
  description: "The terms for using Readli, including how private family voices and parent approvals work.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
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
